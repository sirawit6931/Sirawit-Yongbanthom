// public/admin/js/adminApp.js

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
	                                     from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, addDoc, serverTimestamp, query, where }
	                                     from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Firebase config (same project as mobile app) ──────────────────────────

const firebaseConfig = {
	apiKey:            'AIzaSyBEyXIfw7UCrOq7leUtzZslt5Do7K0V2Kc',
	authDomain:        'my-eng-auth.firebaseapp.com',
	projectId:         'my-eng-auth',
	storageBucket:     'my-eng-auth.firebasestorage.app',
	messagingSenderId: '961630734061',
	appId:             '1:961630734061:web:2353200f405578891a2ee4',
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── DOM refs ───────────────────────────────────────────────────────────────

const loginView     = document.getElementById('login-view');
const dashView      = document.getElementById('dashboard-view');
const loginForm     = document.getElementById('login-form');
const loginError    = document.getElementById('login-error');
const loginBtn      = document.getElementById('login-btn');
const loginLabel    = document.getElementById('login-label');
const loginSpinner  = document.getElementById('login-spinner');
const logoutBtn     = document.getElementById('logout-btn');
const togglePwBtn   = document.getElementById('toggle-pw');
const inpEmail      = document.getElementById('inp-email');
const inpPassword   = document.getElementById('inp-password');
const topbarUser    = document.getElementById('topbar-user');

// ── Auth state watcher ─────────────────────────────────────────────────────

// Only auto-redirect if we already verified admin in this session
onAuthStateChanged(auth, (user) => {
	if (!user) {
		showLogin();
	}
	// We do NOT auto-redirect to dashboard here because the admin code
	// check is stateful (done at login time). On page reload the user must
	// log in again for security.
});

// ── Show / hide views ──────────────────────────────────────────────────────

function showLogin() {
	loginView.classList.remove('hidden');
	dashView.classList.add('hidden');
}

function showDashboard(email) {
	loginView.classList.add('hidden');
	dashView.classList.remove('hidden');
	topbarUser.textContent    = email;
	loadStats();
}

// ── Toggle password visibility ─────────────────────────────────────────────

togglePwBtn.addEventListener('click', () => {
	const isText = inpPassword.type === 'text';
	inpPassword.type   = isText ? 'password' : 'text';
	togglePwBtn.textContent = isText ? '🙈' : '👁';
});

// ── Login form submit ──────────────────────────────────────────────────────

loginForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	setLoginLoading(true);
	loginError.classList.add('hidden');

	const email    = inpEmail.value.trim();
	const password = inpPassword.value;

	try {
		// 1. Sign in with Firebase Auth
		await signInWithEmailAndPassword(auth, email, password);

		// 2. Check admins/{email.toLowerCase()} document exists
		const adminRef  = doc(db, 'admins', email.toLowerCase());
		const adminSnap = await getDoc(adminRef);
		if (!adminSnap.exists()) {
			await signOut(auth);
			showError('ไม่พบสิทธิ์ Admin สำหรับบัญชีนี้');
			return;
		}

		// 3. All checks passed — show dashboard
		showDashboard(email);
	} catch (err) {
		await signOut(auth).catch(() => {});
		const code = err.code || '';
		if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
			showError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
		} else if (code === 'auth/too-many-requests') {
			showError('พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่');
		} else {
			showError('เข้าสู่ระบบไม่สำเร็จ: ' + (err.message || code));
		}
	} finally {
		setLoginLoading(false);
	}
});

function setLoginLoading(loading) {
	if (loading) {
		loginLabel.classList.add('hidden');
		loginSpinner.classList.remove('hidden');
		loginBtn.disabled = true;
	} else {
		loginLabel.classList.remove('hidden');
		loginSpinner.classList.add('hidden');
		loginBtn.disabled = false;
	}
}

function showError(msg) {
	loginError.textContent = msg;
	loginError.classList.remove('hidden');
}

// ── Logout ─────────────────────────────────────────────────────────────────

logoutBtn.addEventListener('click', async (e) => {
	e.preventDefault();
	try {
		await signOut(auth);
		showLogin();
	} catch (err) {
		alert('ออกจากระบบไม่สำเร็จ: ' + err.message);
	}
});

// ── Sidebar collapse ───────────────────────────────────────────────────────

const collapseToggle = document.querySelector('.collapse-toggle');
if (collapseToggle) {
	collapseToggle.addEventListener('click', () => {
		document.querySelector('.sidebar').classList.toggle('collapsed');
	});
}

// ── Navigation ─────────────────────────────────────────────────────────────

function navigateToSection(section) {
	document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
	const navItem = document.querySelector('.nav-item[data-section="' + section + '"]');
	if (navItem) navItem.classList.add('active');
	document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
	const target = document.getElementById('section-' + section);
	if (target) target.classList.remove('hidden');
	if (section === 'vocabulary') loadVocabSets();
	if (section === 'tense') loadTenseSets();
	if (section === 'listening-reading') loadLRSets();
	if (section === 'vocab-library') loadVocab();
	if (section === 'stats') loadExerciseStats();
}

document.querySelectorAll('.nav-item').forEach(item => {
	item.addEventListener('click', (e) => {
		// Let the logout link handle its own action
		if (item.classList.contains('nav-logout')) return;
		e.preventDefault();
		navigateToSection(item.dataset.section);
	});
});

// Quick-menu on Dashboard (mirrors sidebar navigation)
document.querySelectorAll('.quick-menu-item').forEach(item => {
	item.addEventListener('click', (e) => {
		e.preventDefault();
		navigateToSection(item.dataset.section);
	});
});

// ── Overview stats ─────────────────────────────────────────────────────────

async function loadStats() {
	// Members come from Firebase Auth (source of truth) via the backend
	// Admin API — counting Firestore 'users' docs shows 0 for auth-only members.
	const statUsers = document.getElementById('stat-users');
	const [apiRes, exercises, vocab, admins] = await Promise.all([
		(async () => {
			try {
				const token = await auth.currentUser.getIdToken();
				const res = await fetch('/api/admin/users', { headers: { Authorization: 'Bearer ' + token } });
				const data = await res.json();
				if (data.success && typeof data.count === 'number') return data.count;
				throw new Error(data.error || 'Unexpected users API response');
			} catch (err) {
				console.error('[loadStats-users]', err.message);
				if (statUsers) statUsers.textContent = '—';
				return null;
			}
		})(),
		getDocs(collection(db, 'exercises')),
		getDocs(collection(db, 'vocabulary')),
		getDocs(collection(db, 'admins')),
	]);
	const statExercises = document.getElementById('stat-exercises');
	const statVocab     = document.getElementById('stat-vocab');
	const statAdmins    = document.getElementById('stat-admins');
	if (statUsers && apiRes != null) statUsers.textContent = String(apiRes);
	if (statExercises) statExercises.textContent = String(exercises.docs?.length || 0);
	if (statVocab)     statVocab.textContent     = String(vocab.docs?.length || 0);
	if (statAdmins)    statAdmins.textContent    = String(admins.docs?.length || 0);
}



// ── Pagination helper ──────────────────────────────────────────────────────

function renderPagination(container, totalItems, itemsPerPage, currentPage, onPageChange) {
	if (!container) return;
	const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
	let html = '';
	for (let p = 1; p <= totalPages; p++) {
		html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
	}
	container.innerHTML = html;
	container.querySelectorAll('.page-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			const p = parseInt(btn.dataset.page, 10);
			if (p !== currentPage && typeof onPageChange === 'function') onPageChange(p);
		});
	});
}

// ── Users CRUD ─────────────────────────────────────────────────────────────

let allUserRows = [];

async function loadUsers() {
	const loading = document.getElementById('users-loading');
	const table   = document.getElementById('users-table');
	const tbody   = document.getElementById('users-tbody');
	const pagin   = document.getElementById('users-pagination');

	loading.classList.remove('hidden');
	loading.textContent = 'กำลังโหลด...';
	table.classList.add('hidden');
	tbody.innerHTML = '';

	const renderList = (rows) => {
		allUserRows = rows;
		allUserRows.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
		const itemsPerPage = 15;
		const currentPage  = 1;
		renderUsersPage(tbody, allUserRows, currentPage, itemsPerPage);
		renderPagination(pagin, allUserRows.length, itemsPerPage, currentPage, (p) => {
			renderUsersPage(tbody, allUserRows, p, itemsPerPage);
			renderPagination(pagin, allUserRows.length, itemsPerPage, p, null);
		});
		loading.classList.add('hidden');
		table.classList.remove('hidden');
	};

	try {
		// 1) Primary: backend Admin API → Admin SDK bypasses Firestore read rules
		const token = await auth.currentUser.getIdToken();
		const res = await fetch('/api/admin/users', { headers: { Authorization: 'Bearer ' + token } });
		const data = await res.json();
		if (data.success && Array.isArray(data.data)) {
			renderList(data.data);
			return;
		}
		throw new Error(data.error || 'Unexpected users API response');
	} catch (err) {
		console.error('[loadUsers] Backend users API failed, falling back to client SDK:', err.message);
	}

	try {
		// 2) Fallback: direct Firestore SDK (may be denied by rules)
		const snap = await getDocs(collection(db, 'users'));
		const rows = snap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));
		renderList(rows);
	} catch (err2) {
		console.error('[loadUsers] Fetch users failed:', err2.message, err2);
		loading.classList.add('hidden');
		loading.textContent = 'โหลดผู้ใช้ไม่สำเร็จ: ' + err2.message;
		table.classList.add('hidden');
		tbody.innerHTML = '<tr><td colspan="6" class="empty-row">โหลดข้อมูลไม่สำเร็จ — ตรวจ Firebase Rules / backend</td></tr>';
	}
}

function renderUsersPage(tbody, rows, page, perPage) {
	const start = (page - 1) * perPage;
	const slice = rows.slice(start, start + perPage);
	if (slice.length === 0) {
		tbody.innerHTML = '<tr><td colspan="6" class="empty-row">ไม่พบข้อมูลสมาชิก</td></tr>';
		return;
	}
	tbody.innerHTML = slice.map((u, i) => `
		<tr>
			<td>${start + i + 1}</td>
			<td><strong>${u.id}</strong></td>
			<td>${u.email || '—'}</td>
			<td>${u.name || u.displayName || u.username || '—'}</td>
			<td>${u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString('th-TH') : '—'}</td>
			<td><button class="btn-delete user-delete-btn" data-id="${u.id}">🗑 ลบ</button></td>
		</tr>`).join('');
}

document.getElementById('users-tbody').addEventListener('click', async (e) => {
	const deleteBtn = e.target.closest('.user-delete-btn');
	if (!deleteBtn) return;
	const id = deleteBtn.dataset.id;
	if (!confirm(`Delete user "${id}" ?\nAll data of this user will be removed`)) return;

	try {
		await deleteDoc(doc(db, 'users', id));
		await loadUsers();
		await loadStats();
	} catch (err) {
		alert('Delete failed: ' + err.message);
	}
});

// ══════════════════════════════════════════════════════════════════════════
// Exercises CRUD (Generator + Manual + Item-level edit)
// ══════════════════════════════════════════════════════════════════════════

const CAT_NAMES = { vocab: '📚 คำศัพท์', tense: '⏱ Tense', listening: '🎧 ฟังและอ่าน' };

let allExerciseRows = [];
let exActiveCategory = 'all';
const EX_PAGE_SIZE = 10;

async function getAuthHeaders() {
	const user = auth.currentUser;
	if (!user) throw new Error('Not logged in');
	const token = await user.getIdToken();
	return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
}

async function loadExercises() {
	const loading = document.getElementById('exercises-loading');
	const table   = document.getElementById('exercises-table');
	const tbody   = document.getElementById('exercises-tbody');
	const pagin   = document.getElementById('exercises-pagination');

	loading.classList.remove('hidden');
	table.classList.add('hidden');

	try {
		const snap = await getDocs(collection(db, 'exercises'));
		allExerciseRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
		allExerciseRows.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));

		renderExercisesPage(tbody, pagin);
		loading.classList.add('hidden');
		table.classList.remove('hidden');
	} catch (err) {
		loading.textContent = 'Load failed: ' + err.message;
	}
}

function getFilteredExerciseRows() {
	if (exActiveCategory === 'all') return allExerciseRows;
	return allExerciseRows.filter(r => r.category === exActiveCategory);
}

function renderExercisesPage(tbody, pagin, page = 1) {
	const rows  = getFilteredExerciseRows();
	const start = (page - 1) * EX_PAGE_SIZE;
	const slice = rows.slice(start, start + EX_PAGE_SIZE);
	tbody.innerHTML = slice.map((d, i) => {
		const items = Array.isArray(d.items) ? d.items : (Array.isArray(d.questions) ? d.questions : []);
		const statusBadge = d.status === 'published'
			? '<span class="status-badge published status-toggle" data-id="' + d.id + '" data-status="published" title="คลิกเพื่อเปลี่ยนสถานะ">เผยแพร่</span>'
			: '<span class="status-badge draft status-toggle" data-id="' + d.id + '" data-status="draft" title="คลิกเพื่อเปลี่ยนสถานะ">ร่าง</span>';
		return `
			<tr>
				<td>${start + i + 1}</td>
				<td><strong>${d.title || d.name || d.id}</strong> ${statusBadge}</td>
				<td>${CAT_NAMES[d.category] || d.category || '—'}</td>
				<td>${d.description || '—'}</td>
				<td>${items.length}</td>
				<td style="white-space:nowrap">
					<button class="btn-action view ex-view-btn" data-id="${d.id}">👁 ดู</button>
					<button class="btn-action edit ex-edit-btn" data-id="${d.id}">✏️ Edit</button>
					<button class="btn-action delete ex-delete-btn" data-id="${d.id}" data-title="${d.title || ''}">🗑 ลบ</button>
				</td>
			</tr>`;
	}).join('');
	if (pagin) renderPagination(pagin, rows.length, EX_PAGE_SIZE, page, (p) => renderExercisesPage(tbody, pagin, p));
}

document.querySelectorAll('#exercise-tabs .tab-btn').forEach(btn => {
	btn.addEventListener('click', () => {
		document.querySelectorAll('#exercise-tabs .tab-btn').forEach(b => b.classList.remove('active'));
		btn.classList.add('active');
		exActiveCategory = btn.dataset.category || 'all';
		renderExercisesPage(document.getElementById('exercises-tbody'), document.getElementById('exercises-pagination'));
	});
});

// ══════════════════════════════════════════════════════════════════════════
// Exercise Modal (Add / Edit) — Mode Switcher + Manual Item Editor
// ══════════════════════════════════════════════════════════════════════════

const exModal           = document.getElementById('exercise-modal');
const exModalTitle      = document.getElementById('exercise-modal-title');
const exId              = document.getElementById('ex-id');
const exTitle           = document.getElementById('ex-title');
const exCategory        = document.getElementById('ex-category');
const exDescription     = document.getElementById('ex-description');
const exLevel           = document.getElementById('ex-level');
const exTts             = document.getElementById('ex-tts');
const exError           = document.getElementById('exercise-error');
const exSaveBtn         = document.getElementById('ex-save-btn');
const exCancelBtn       = document.getElementById('exercise-cancel-btn');
const exCloseX          = document.getElementById('ex-close-x');
const exGenerateBtn     = document.getElementById('ex-generate-btn');
const exGenerateLabel   = document.getElementById('ex-generate-label');
const exSpinner         = document.getElementById('ex-spinner');
const exCount           = document.getElementById('ex-count');
const exCountLabel      = document.getElementById('ex-count-label');
const exPublishToggle   = document.getElementById('ex-publish-toggle');
const exToggleLabel     = document.getElementById('ex-toggle-label');
const exGenPreview        = document.getElementById('ex-gen-preview');
const exGenPreviewCount   = document.getElementById('ex-gen-preview-count');
const exGenPreviewStatus  = document.getElementById('ex-gen-preview-status');
const exGenPreviewItems   = document.getElementById('ex-gen-preview-items');
const exGeneratorPanel  = document.getElementById('ex-generator-panel');
const exManualPanel     = document.getElementById('ex-manual-panel');
const exAddItemBtn      = document.getElementById('ex-add-item-btn');
const exItemList        = document.getElementById('ex-item-editor-list');
const exItemCount       = document.getElementById('ex-item-count');

let exActiveMode = 'generator';
let exGeneratedExercise = null;
let exManualItems = [];

function escHtml(s) {
	return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setExMode(mode) {
	exActiveMode = mode;
	document.getElementById('mode-btn-generator').classList.toggle('active', mode === 'generator');
	document.getElementById('mode-btn-manual').classList.toggle('active', mode === 'manual');

	if (mode === 'generator') {
		exGeneratorPanel.classList.remove('hidden');
		exManualPanel.classList.add('hidden');
		exGenerateBtn.classList.remove('hidden');
		exSaveBtn.classList.add('hidden');
	} else {
		exGeneratorPanel.classList.add('hidden');
		exManualPanel.classList.remove('hidden');
		exGenerateBtn.classList.add('hidden');
		exSaveBtn.classList.remove('hidden');
	}
	exError.classList.add('hidden');
}

document.getElementById('mode-btn-generator').addEventListener('click', () => setExMode('generator'));
document.getElementById('mode-btn-manual').addEventListener('click', () => setExMode('manual'));

// อัปเดต counter hint เมื่อเปลี่ยน category (vocab มีกฎ 10–15 ข้อ)
exCategory.addEventListener('change', () => renderManualItems());

exCount.addEventListener('input', () => { exCountLabel.textContent = exCount.value; });

exPublishToggle.addEventListener('change', () => {
	const publish = exPublishToggle.checked;
	exToggleLabel.textContent = publish ? 'Publish now' : 'Save as draft';
	exGenPreviewStatus.textContent = publish ? 'published' : 'draft';
	exGenPreviewStatus.className = publish ? 'status-badge published' : 'status-badge draft';
});

function openExModal(mode, data = {}) {
	exModalTitle.textContent = mode === 'add' ? 'Add exercise set' : 'Edit exercise set';
	exId.value          = data.id || '';
	exTitle.value       = data.title || '';
	exCategory.value    = data.category || 'vocab';
	exDescription.value = data.description || '';
	exLevel.value       = data.level || 'A2';
	exTts.value         = data.ttsSystem || 'female';
	exCount.value       = 10;
	exCountLabel.textContent = 10;
	exPublishToggle.checked = false;
	exToggleLabel.textContent = 'Save as draft';
	exError.classList.add('hidden');
	exGenPreview.classList.add('hidden');
	exGenPreviewItems.innerHTML = '';
	exGenPreviewCount.textContent = '0';
	exGeneratedExercise = null;

	exManualItems = [];
	if (mode === 'edit' && Array.isArray(data.items)) {
		exManualItems = data.items.map(it => ({ ...it, _uid: crypto.randomUUID() }));
	}
	renderManualItems();

	setExMode(mode === 'edit' && exManualItems.length > 0 ? 'manual' : 'generator');
	exModal.classList.remove('hidden');
}

document.getElementById('add-exercise-btn').addEventListener('click', () => openExModal('add'));

function closeExModal() { exModal.classList.add('hidden'); }
exCancelBtn.addEventListener('click', closeExModal);
exCloseX.addEventListener('click', closeExModal);
exModal.addEventListener('click', (e) => { if (e.target === exModal) closeExModal(); });

// ── Manual item editor ──────────────────────────────────────────────────────

// จำนวนข้อ vocab: 10–15 ตาม spec (6.1.5)
const VOCAB_MANUAL_MIN = 10;
const VOCAB_MANUAL_MAX = 15;

function getVocabItemCountColor(count) {
	if (count < VOCAB_MANUAL_MIN) return '#c62828';  // แดง — ยังไม่ถึงขั้นต่ำ
	if (count <= VOCAB_MANUAL_MAX) return '#2e7d32';  // เขียว — อยู่ในช่วงที่ถูกต้อง
	return '#e65100';                                  // ส้ม — เกินสูงสุด
}

function renderManualItems() {
	const count = exManualItems.length;
	const isVocab = exCategory.value === 'vocab';

	// อัปเดต counter + hint ใต้ตัวเลข
	exItemCount.textContent = count;
	exItemCount.style.color = isVocab ? getVocabItemCountColor(count) : '';
	exItemCount.style.fontWeight = 'bold';

	// แสดง hint บอกจำนวนที่ต้องการ (เฉพาะ vocab)
	let hintEl = document.getElementById('ex-item-count-hint');
	if (!hintEl) {
		hintEl = document.createElement('span');
		hintEl.id = 'ex-item-count-hint';
		hintEl.style.cssText = 'font-size:12px;margin-left:6px;';
		exItemCount.parentNode?.appendChild(hintEl);
	}
	if (isVocab) {
		if (count < VOCAB_MANUAL_MIN) {
			hintEl.textContent = `(ต้องการอีก ${VOCAB_MANUAL_MIN - count} ข้อ — ต้องมีอย่างน้อย ${VOCAB_MANUAL_MIN} ข้อ)`;
			hintEl.style.color = '#c62828';
		} else if (count > VOCAB_MANUAL_MAX) {
			hintEl.textContent = `(เกินกำหนด ${count - VOCAB_MANUAL_MAX} ข้อ — สูงสุด ${VOCAB_MANUAL_MAX} ข้อ)`;
			hintEl.style.color = '#e65100';
		} else {
			hintEl.textContent = `(${count}/${VOCAB_MANUAL_MAX} ✓)`;
			hintEl.style.color = '#2e7d32';
		}
	} else {
		hintEl.textContent = '';
	}

	// ปิดปุ่ม Add item เมื่อถึง max (เฉพาะ vocab)
	exAddItemBtn.disabled = isVocab && count >= VOCAB_MANUAL_MAX;
	exAddItemBtn.title    = (isVocab && count >= VOCAB_MANUAL_MAX)
		? `ครบ ${VOCAB_MANUAL_MAX} ข้อแล้ว (สูงสุดที่กำหนด)`
		: '';

	if (count === 0) {
		exItemList.innerHTML = '<div class="text-muted" style="padding:16px;text-align:center;">No items yet — click "+ Add item" to start</div>';
		return;
	}
	exItemList.innerHTML = exManualItems.map((item, idx) => {
		const uid = item._uid;
		const dist = Array.isArray(item.distractors) ? item.distractors.join(', ') : (item.distractors || '');
		return `
			<div class="manual-item-card" data-uid="${uid}">
				<div class="mi-header">
					<span class="mi-num">Item ${idx + 1}</span>
					<button type="button" class="mi-delete-btn" data-uid="${uid}" title="Remove item"><ion-icon name="trash-outline"></ion-icon></button>
				</div>
				<div class="form-row">
					<div class="form-field">
						<label>Word (EN) <span class="req">*</span></label>
						<input class="mi-wordEN" type="text" placeholder="e.g. apple" value="${escHtml(item.wordEN || '')}" data-uid="${uid}" />
					</div>
					<div class="form-field">
						<label>Translation (TH) <span class="req">*</span></label>
						<input class="mi-wordTH" type="text" placeholder="e.g. apple" value="${escHtml(item.wordTH || '')}" data-uid="${uid}" />
					</div>
				</div>
				<div class="form-field">
					<label>Example sentence</label>
					<input class="mi-sentence" type="text" placeholder="e.g. apple" value="${escHtml(item.sentence || '')}" data-uid="${uid}" />
				</div>
				<div class="form-field">
					<label>Sentence translation</label>
					<input class="mi-sentenceTH" type="text" placeholder="TH translation of the sentence" value="${escHtml(item.sentenceTH || '')}" data-uid="${uid}" />
				</div>
				<div class="form-field">
					<label>Distractors (comma separated)</label>
					<input class="mi-distractors" type="text" placeholder="e.g. apple" value="${escHtml(dist)}" data-uid="${uid}" />
					<div class="field-hint">1-2 distractor words (not including the main word)</div>
				</div>
			</div>`;
	}).join('');
}

exAddItemBtn.addEventListener('click', () => {
	exManualItems.push({ _uid: crypto.randomUUID(), wordEN: '', wordTH: '', sentence: '', sentenceTH: '', distractors: [] });
	renderManualItems();
	setTimeout(() => exItemList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
});

exItemList.addEventListener('click', (e) => {
	const delBtn = e.target.closest('.mi-delete-btn');
	if (!delBtn) return;
	exManualItems = exManualItems.filter(it => it._uid !== delBtn.dataset.uid);
	renderManualItems();
});

exItemList.addEventListener('input', (e) => {
	const inp = e.target;
	const uid = inp.dataset.uid;
	if (!uid) return;
	const item = exManualItems.find(it => it._uid === uid);
	if (!item) return;
	if (inp.classList.contains('mi-wordEN')) item.wordEN = inp.value.trim();
	else if (inp.classList.contains('mi-wordTH')) item.wordTH = inp.value.trim();
	else if (inp.classList.contains('mi-sentence')) item.sentence = inp.value.trim();
	else if (inp.classList.contains('mi-sentenceTH')) item.sentenceTH = inp.value.trim();
	else if (inp.classList.contains('mi-distractors')) {
		item.distractors = inp.value.split(',').map(s => s.trim()).filter(Boolean);
	}
});

function getCleanManualItems() {
	return exManualItems.map(it => {
		const { _uid, ...rest } = it;
		return rest;
	});
}

// ── Generator preview ───────────────────────────────────────────────────────

function renderExGeneratedPreview(ex) {
	const items = Array.isArray(ex.items) ? ex.items : [];
	exGenPreviewCount.textContent = items.length;
	exGenPreviewStatus.textContent = ex.status === 'published' ? 'published' : 'draft';
	exGenPreviewStatus.className = 'status-badge ' + (ex.status === 'published' ? 'published' : 'draft');

	exGenPreviewItems.innerHTML = items.map((it, i) => {
		const en = escHtml(it.wordEN || '');
		const th = escHtml(it.wordTH || '');
		const sent = escHtml(it.sentence || '');
		const sentTH = escHtml(it.sentenceTH || '');
		const distractors = Array.isArray(it.distractors)
			? it.distractors.map(d => `<span class="pi-distractor-tag">${escHtml(d)}</span>`).join('')
			: '';
		const blanked = sent.replace(/_{2,}|_/g, '<span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>');
		return `
			<div class="preview-item">
				<div class="pi-num">${i + 1}</div>
				<div class="pi-body">
					<div class="pi-word"><span class="pi-en">${en}</span> = <span class="pi-th">${th}</span></div>
					<div class="pi-sentence">${blanked}</div>
					${sentTH ? `<div class="pi-sentence" style="font-size:12px;color:#999">${sentTH}</div>` : ''}
					${distractors ? `<div class="pi-distractors">${distractors}</div>` : ''}
				</div>
			</div>`;
	}).join('');
}

function exShowError(msg) {
	exError.textContent = msg;
	exError.classList.remove('hidden');
}

exGenerateBtn.addEventListener('click', async () => {
	const title = exTitle.value.trim();
	const level = exLevel.value;
	const size  = parseInt(exCount.value, 10);
	const description = exDescription.value.trim();
	const ttsSystem   = exTts.value;

	exError.classList.add('hidden');
	if (!title) { exShowError('Please enter a title'); return; }
	if (!['A1', 'A2'].includes(level)) { exShowError('Level must be A1 or A2'); return; }

	exGenerateLabel.textContent = 'Generating...';
	exSpinner.classList.remove('hidden');

	try {
		const headers = await getAuthHeaders();
		const res = await fetch('/api/admin/exercises/generate', {
			method: 'POST',
			headers,
			body: JSON.stringify({ level, size, title, description, ttsSystem }),
		});
		const body = await res.json().catch(() => ({}));
		if (!res.ok || !body.success) throw new Error(body.error || 'Generate failed (HTTP ' + res.status + ')');

		exGeneratedExercise = body.data;
		renderExGeneratedPreview(exGeneratedExercise);
		exGenPreview.classList.remove('hidden');

		exGenerateBtn.classList.add('hidden');
		exSaveBtn.classList.remove('hidden');
	} catch (err) {
		exShowError(err.message || 'Generation error');
	} finally {
		exSpinner.classList.add('hidden');
		exGenerateLabel.textContent = 'สร้างแบบฝึกหัด';
	}
});

// ── Save (PUT for updates, POST for manual create) ─────────────────────────

exSaveBtn.addEventListener('click', async () => {
	exError.classList.add('hidden');

	// Generator mode: publish the draft already created by /generate
	if (exActiveMode === 'generator') {
		if (!exGeneratedExercise || !exGeneratedExercise.id) {
			exShowError('No generated exercise to save');
			return;
		}
		try {
			if (exPublishToggle.checked) {
				const headers = await getAuthHeaders();
				const res = await fetch('/api/admin/exercises/' + encodeURIComponent(exGeneratedExercise.id),
					{ method: 'PUT', headers, body: JSON.stringify({ status: 'published' }) });
				const upd = await res.json().catch(() => ({}));
				if (!res.ok || !upd.success) throw new Error(upd.error || 'Publish failed');
			}
			closeExModal();
			await loadExercises();
			await loadStats();
		} catch (err) {
			exShowError(err.message || 'Save failed');
		}
		return;
	}

	// Manual mode: build payload with items[]
	const title = exTitle.value.trim();
	const cat   = exCategory.value;
	const desc  = exDescription.value.trim();
	const level = exLevel.value;
	const tts   = exTts.value;

	if (!title) { exShowError('Please enter a title'); return; }
	if (!['A1', 'A2'].includes(level)) { exShowError('Level must be A1 or A2'); return; }

	const items = getCleanManualItems();
	if (cat === 'vocab') {
		if (items.length < VOCAB_MANUAL_MIN) {
			exShowError(`แบบฝึกหัดคำศัพท์ต้องมีอย่างน้อย ${VOCAB_MANUAL_MIN} ข้อ (ตอนนี้มี ${items.length} ข้อ)`);
			return;
		}
		if (items.length > VOCAB_MANUAL_MAX) {
			exShowError(`แบบฝึกหัดคำศัพท์ต้องมีไม่เกิน ${VOCAB_MANUAL_MAX} ข้อ (ตอนนี้มี ${items.length} ข้อ)`);
			return;
		}
	} else {
		if (items.length === 0) { exShowError('Please add at least 1 question item'); return; }
	}
	for (let i = 0; i < items.length; i++) {
		if (!items[i].wordEN || !items[i].wordTH) {
			exShowError('Item ' + (i + 1) + ': please fill in Word (EN) and Translation (TH)');
			return;
		}
	}

	const payload = {
		title, category: cat, description: desc, level, ttsSystem: tts,
		status: 'draft',
		items,
		updatedAt: serverTimestamp(),
	};

	try {
		const headers = await getAuthHeaders();
		if (exId.value) {
			// Update existing exercise (metadata + full items[])
			const res = await fetch('/api/admin/exercises/' + encodeURIComponent(exId.value),
				{ method: 'PUT', headers, body: JSON.stringify(payload) });
			const upd = await res.json().catch(() => ({}));
			if (!res.ok || !upd.success) throw new Error(upd.error || 'Update failed');
		} else {
			// Create new exercise manually
			payload.createdAt = serverTimestamp();
			const res = await fetch('/api/admin/exercises',
				{ method: 'POST', headers, body: JSON.stringify(payload) });
			const body = await res.json().catch(() => ({}));
			if (!res.ok || !body.success) throw new Error(body.error || 'Create failed');
		}

		closeExModal();
		await loadExercises();
		await loadStats();
	} catch (err) {
		exShowError(err.message || 'Save failed');
	}
});

// ── Table actions: view / edit / delete ────────────────────────────────────

document.getElementById('exercises-tbody').addEventListener('click', async (e) => {
	const viewBtn   = e.target.closest('.ex-view-btn');
	const editBtn   = e.target.closest('.ex-edit-btn');
	const deleteBtn = e.target.closest('.ex-delete-btn');

	if (viewBtn) {
		const row = allExerciseRows.find(r => r.id === viewBtn.dataset.id);
		if (row) {
			const items = Array.isArray(row.items) ? row.items : (Array.isArray(row.questions) ? row.questions : []);
			alert(
				'Title: ' + (row.title || row.name || row.id) + '\n' +
				'Category: ' + (CAT_NAMES[row.category] || row.category || '—') + '\n' +
				'Description: ' + (row.description || '—') + '\n' +
				'Items: ' + items.length
			);
		}
		return;
	}

	if (editBtn) {
		try {
			const docRef  = doc(db, 'exercises', editBtn.dataset.id);
			const docSnap = await getDoc(docRef);
			if (!docSnap.exists()) { alert('Exercise not found'); return; }
			const data = docSnap.data();
			openExModal('edit', {
				id: editBtn.dataset.id,
				title: data.title || '',
				category: data.category || 'vocab',
				description: data.description || '',
				level: data.level || 'A2',
				ttsSystem: data.ttsSystem || 'female',
				items: Array.isArray(data.items) ? data.items : [],
			});
		} catch (err) {
			alert('Failed to load exercise: ' + err.message);
		}
	}

	if (deleteBtn) {
		const title = deleteBtn.dataset.title || deleteBtn.dataset.id;
		if (!confirm(`Delete exercise "${title}" ?\nAll data in this set will be removed`)) return;
		try {
			await deleteDoc(doc(db, 'exercises', deleteBtn.dataset.id));
			await loadExercises();
			await loadStats();
		} catch (err) {
			alert('Delete failed: ' + err.message);
		}
	}
});

// ══════════════════════════════════════════════════════════════════════════
// Statistics table (section-stats)
// ══════════════════════════════════════════════════════════════════════════

let allStatRows = [];
let statPage = 1;
const STAT_PAGE_SIZE = 15;

async function loadExerciseStats() {
	const loading = document.getElementById('stats-loading');
	const table   = document.getElementById('stats-table');
	const tbody   = document.getElementById('stats-tbody');
	const pagin   = document.getElementById('stats-pagination');
	const countEl = document.getElementById('stats-count');

	if (!tbody) return;

	loading.classList.remove('hidden');
	table.classList.add('hidden');

	try {
		const snap = await getDocs(collection(db, 'statistics'));
		allStatRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
		allStatRows.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
		renderExerciseStatsPage(tbody, pagin, countEl, statPage);
		loading.classList.add('hidden');
		table.classList.remove('hidden');
	} catch (err) {
		loading.textContent = 'Load failed: ' + err.message;
	}
}

function renderExerciseStatsPage(tbody, pagin, countEl, page) {
	const emailFilter = document.getElementById('stats-filter-email')?.value.trim().toLowerCase() || '';
	const catFilter   = document.getElementById('stats-filter-cat')?.value || '';

	let rows = allStatRows;
	if (emailFilter) rows = rows.filter(r => (r.email || '').toLowerCase().includes(emailFilter));
	if (catFilter)   rows = rows.filter(r => r.category === catFilter);

	const start = (page - 1) * STAT_PAGE_SIZE;
	const slice = rows.slice(start, start + STAT_PAGE_SIZE);

	tbody.innerHTML = slice.map((d, i) => {
		const passed = d.passed
			? '<span style="color:#2e7d32;font-weight:600">Pass</span>'
			: '<span style="color:#c62828">Fail</span>';
		const date = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleString('th-TH') : '—';
		return `
			<tr>
				<td>${start + i + 1}</td>
				<td>${d.email || '—'}</td>
				<td>${CAT_NAMES[d.category] || d.category || '—'}</td>
				<td>${d.exerciseName || '—'}</td>
				<td>${d.score ?? '—'}/${d.totalQuestions ?? '—'}</td>
				<td>${d.percentage ?? '—'}%</td>
				<td>${d.timeSpent ?? '—'}</td>
				<td>${passed}</td>
				<td>${date}</td>
			</tr>`;
	}).join('');

	if (countEl) countEl.textContent = 'Total: ' + rows.length + ' record(s)';
	if (pagin) renderPagination(pagin, rows.length, STAT_PAGE_SIZE, page, (p) => renderExerciseStatsPage(tbody, pagin, countEl, p));
}

const statsSearchBtn = document.getElementById('stats-search-btn');
if (statsSearchBtn) {
	statsSearchBtn.addEventListener('click', () => {
		renderExerciseStatsPage(
			document.getElementById('stats-tbody'),
			document.getElementById('stats-pagination'),
			document.getElementById('stats-count'),
			1
		);
	});
}

// ══════════════════════════════════════════════════════════════════════════
// Vocab CRUD
// ══════════════════════════════════════════════════════════════════════════

let allVocabRows = [];

async function loadVocab() {
	const loading = document.getElementById('vocab-loading');
	const table   = document.getElementById('vocab-table');
	const tbody   = document.getElementById('vocab-tbody');

	loading.classList.remove('hidden');
	table.classList.add('hidden');

	try {
		const snap = await getDocs(collection(db, 'vocabulary'));
		allVocabRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
		allVocabRows.sort((a, b) => (a.wordEN || '').localeCompare(b.wordEN || ''));
		invalidateVocabSuggestCache(); // คลังเปลี่ยน → autocomplete รอบหน้าจะโหลดใหม่

		tbody.innerHTML = allVocabRows.map((v, i) => `
			<tr>
				<td>${i + 1}</td>
				<td><strong>${v.wordEN || '—'}</strong></td>
				<td>${v.wordTH || '—'}</td>
				<td>${v.ttsVoice || '—'}</td>
				<td>
					<button class="btn-action edit vocab-edit-btn" data-id="${v.id}">✏️ Edit</button>
					<button class="btn-action delete vocab-delete-btn" data-id="${v.id}" data-word="${v.wordEN || ''}">🗑 ลบ</button>
				</td>
			</tr>`).join('');

		loading.classList.add('hidden');
		table.classList.remove('hidden');
	} catch (err) {
		loading.textContent = 'Load failed: ' + err.message;
	}
}

// Vocab modal
const vocabModal     = document.getElementById('vocab-modal');
const vocabModalTitle = document.getElementById('vocab-modal-title');
const vocabDocId     = document.getElementById('vocab-doc-id');
const vocabWordEN    = document.getElementById('vocab-wordEN');
const vocabWordTH    = document.getElementById('vocab-wordTH');
const vocabTtsVoice  = document.getElementById('vocab-ttsVoice');
const vocabError     = document.getElementById('vocab-error');
const vocabSaveBtn   = document.getElementById('vocab-save-btn');
const vocabCancelBtn = document.getElementById('vocab-cancel-btn');

function openVocabModal(mode, data = {}) {
	vocabModalTitle.textContent = mode === 'add' ? 'Add vocabulary' : 'Edit vocabulary';
	vocabDocId.value    = data.id || '';
	vocabWordEN.value   = data.wordEN || '';
	vocabWordTH.value   = data.wordTH || '';
	vocabTtsVoice.value = data.ttsVoice || '';
	vocabError.classList.add('hidden');
	vocabModal.classList.remove('hidden');
}

document.getElementById('add-vocab-btn').addEventListener('click', () => openVocabModal('add'));
vocabCancelBtn.addEventListener('click', () => vocabModal.classList.add('hidden'));
vocabModal.addEventListener('click', (e) => { if (e.target === vocabModal) vocabModal.classList.add('hidden'); });

vocabSaveBtn.addEventListener('click', async () => {
	const wordEN = vocabWordEN.value.trim();
	const wordTH = vocabWordTH.value.trim();
	const ttsVoice = vocabTtsVoice.value.trim();
	vocabError.classList.add('hidden');

	if (!wordEN || !wordTH) {
		vocabError.textContent = 'Please fill in wordEN and wordTH';
		vocabError.classList.remove('hidden');
		return;
	}

	const payload = { wordEN, wordTH, ttsVoice, updatedAt: serverTimestamp() };
	try {
		if (vocabDocId.value) {
			await updateDoc(doc(db, 'vocabulary', vocabDocId.value), payload);
		} else {
			payload.createdAt = serverTimestamp();
			await addDoc(collection(db, 'vocabulary'), payload);
		}
		vocabModal.classList.add('hidden');
		await loadVocab();
		await loadStats();
	} catch (err) {
		vocabError.textContent = 'Save failed: ' + err.message;
		vocabError.classList.remove('hidden');
	}
});

// Vocab table actions
document.getElementById('vocab-tbody').addEventListener('click', async (e) => {
	const editBtn   = e.target.closest('.vocab-edit-btn');
	const deleteBtn = e.target.closest('.vocab-delete-btn');

	if (editBtn) {
		const row = allVocabRows.find(v => v.id === editBtn.dataset.id);
		if (row) openVocabModal('edit', { id: row.id, wordEN: row.wordEN, wordTH: row.wordTH, ttsVoice: row.ttsVoice });
		return;
	}

	if (deleteBtn) {
		const word = deleteBtn.dataset.word || deleteBtn.dataset.id;
		if (!confirm(`Delete vocabulary "${word}" ?`)) return;
		try {
			await deleteDoc(doc(db, 'vocabulary', deleteBtn.dataset.id));
			await loadVocab();
			await loadStats();
		} catch (err) {
			alert('Delete failed: ' + err.message);
		}
	}
});

// ══════════════════════════════════════════════════════════════════════════
// Vocabulary Sets (Vocab Sets with 4 modes: Matching, Spelling, Listening, FIB)
// ══════════════════════════════════════════════════════════════════════════

async function loadVocabSets() {
	const loading = document.getElementById('vocabset-loading');
	const table = document.getElementById('vocabset-table');
	const tbody = document.getElementById('vocabset-tbody');
	loading.classList.remove('hidden'); table.classList.add('hidden');
	try {
		const token = await auth.currentUser.getIdToken();
		const res = await fetch('/api/admin/vocabulary-sets', { headers: { Authorization: 'Bearer ' + token } });
		const data = await res.json();
		if (!data.success) throw new Error(data.error);
		tbody.innerHTML = '';
		let i = 1;
		data.data.forEach((d) => {
			const tr = document.createElement('tr');
			tr.innerHTML = '<td>' + (i++) + '</td><td><strong>' + d.title + '</strong></td><td>' + (d.totalQuestions ?? d.items?.length ?? 0) + '</td><td><span class="status-badge ' + d.status + ' status-toggle" data-id="' + d.id + '" data-status="' + d.status + '">' + (d.status === 'published' ? 'เผยแพร่' : 'ร่าง') + '</span></td><td><button class="btn-edit vocabset-edit-btn" data-id="' + d.id + '">✏️</button><button class="btn-delete vocabset-del-btn" data-id="' + d.id + '">🗑</button></td>';
			tbody.appendChild(tr);
		});
		loading.classList.add('hidden'); table.classList.remove('hidden');
	} catch (err) { loading.textContent = 'โหลดล้มเหลว: ' + err.message; }
}

// ══════════════════════════════════════════════════════════════════════════
// Tense Sets (Grammar Exercises) - Modal UI
// ══════════════════════════════════════════════════════════════════════════

const tensesetSection = document.getElementById('section-tense');
const tensesetEditSection = document.getElementById('section-tenseset-edit');
const tensesetTitle = document.getElementById('tenseset-title');
const tensesetTag = document.getElementById('tenseset-tag');
const tensesetDesc = document.getElementById('tenseset-description');
const tensesetPubToggle = document.getElementById('tenseset-publish-toggle');
const tensesetErr = document.getElementById('tenseset-error');
const tensesetItemList = document.getElementById('tenseset-item-editor-list');
const tensesetCount = document.getElementById('tenseset-item-count');

let tensesetItems = [];
let tensesetEditId = null;

function openTenseSetModal(mode, data = {}) {
	document.getElementById('tenseset-modal-title').textContent = mode === 'add' ? 'สร้างชุด Tense' : 'แก้ไขชุด Tense';
	tensesetEditId = data.id || null;
	tensesetTitle.value = data.title || '';
	tensesetTag.value = data.tenseTag || 'Present';
	tensesetDesc.value = data.description || '';
	tensesetPubToggle.checked = data.status === 'published';
	document.getElementById('tenseset-toggle-label').textContent = tensesetPubToggle.checked ? 'เผยแพร่ทันที' : 'บันทึกเป็นแบบร่าง';
	tensesetErr.classList.add('hidden');
	
	tensesetItems = [];
	if (data.items && Array.isArray(data.items)) {
		tensesetItems = data.items.map(it => ({ ...it, _uid: crypto.randomUUID() }));
	} else {
		for (let i = 0; i < 10; i++) {
			tensesetItems.push({
				_uid: crypto.randomUUID(),
				mode: 'reorder',
				targetSentence: '',
				sentenceTH: '',
				scrambledWords: [],
				missingWord: '',
				correctAnswer: '',
				tenseIndicator: 'Present',
				ttsVoice: 'female'
			});
		}
	}

	// สอดคล้องกับ Step 2 (สร้างโจทย์)
	setTenseSetStep(1);
	renderTenseSetItems();
	if (tensesetSection) tensesetSection.classList.add('hidden');
	if (tensesetEditSection) tensesetEditSection.classList.remove('hidden');
	window.scrollTo(0, 0);
}

function closeTenseSetModal() {
	if (tensesetEditSection) tensesetEditSection.classList.add('hidden');
	if (tensesetSection) tensesetSection.classList.remove('hidden');
}

function setTenseSetStep(n) {
	for (let i = 1; i <= 2; i++) {
		const pane = document.getElementById('tenseset-step-' + i);
		if (pane) pane.classList.toggle('hidden', i !== n);
		const ind = document.getElementById('ts-wiz-' + i);
		if (ind) {
			ind.classList.toggle('active', i === n);
			ind.classList.toggle('done', i < n);
		}
	}
}

// สลับลำดับคำอัตโนมัติสำหรับโหมดเรียงประโยค — ตัดด้วยช่องว่าง (join กลับได้ประโยคเดิมเป๊ะ)
// + Fisher-Yates shuffle + สุ่มซ้ำกันได้ลำดับเดียวกับต้นฉบับ
function autoScrambleSentence(sentence) {
	const words = String(sentence || '').split(/\s+/).map(w => w.trim()).filter(Boolean);
	if (words.length < 2) return words;
	const original = words.join(' ');
	let shuffled = words.slice();
	for (let attempt = 0; attempt < 10; attempt++) {
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
		}
		if (shuffled.join(' ') !== original) break;
	}
	// ประโยคคำเดียวซ้ำกันทั้งหมด (เช่น "Ha Ha") สลับยังไงก็เหมือนเดิม — ยอมรับผลลัพธ์
	return shuffled;
}

function renderTenseSetItems() {
	tensesetItemList.innerHTML = '';
	tensesetCount.textContent = tensesetItems.length;
	
	tensesetItems.forEach((item, idx) => {
		const card = document.createElement('div');
		card.className = 'tense-item-card';
		card.dataset.uid = item._uid;
		card.style.background = '#f9f9f9';
		card.style.padding = '16px';
		card.style.marginBottom = '12px';
		card.style.borderRadius = '8px';
		card.style.border = '1px solid #e0e0e0';
		
		const header = document.createElement('div');
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.alignItems = 'center';
		header.style.marginBottom = '12px';
		header.innerHTML = `<span style="font-weight:600;color:#333;">ข้อที่ ${idx + 1}</span>` +
			`<button type="button" class="tense-delete-btn" data-uid="${item._uid}" style="background:#ff3b30;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">🗑 ลบ</button>`;
		card.appendChild(header);
		
		const modeRow = document.createElement('div');
		modeRow.style.marginBottom = '12px';
		modeRow.innerHTML = `<label style="display:block;margin-bottom:4px;font-weight:500;">รูปแบบฝึก:</label>` +
			`<select class="tense-mode-select" data-uid="${item._uid}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">` +
			`<option value="reorder" ${item.mode === 'reorder' ? 'selected' : ''}>เรียงประโยค (Sentence Reordering)</option>` +
			`<option value="fillBlank" ${item.mode === 'fillBlank' ? 'selected' : ''}>เติมคำในช่องว่าง (Fill-in-blank)</option>` +
			`<option value="listenRepeat" ${item.mode === 'listenRepeat' ? 'selected' : ''}>ฟังและพูดตาม (Listen & Repeat)</option>` +
			`</select>`;
		card.appendChild(modeRow);
		
		const fieldsDiv = document.createElement('div');
		fieldsDiv.className = 'tense-item-fields';
		
		
		if (item.mode === 'reorder') {
			const previewWords = (item.scrambledWords && item.scrambledWords.length > 0)
				? item.scrambledWords
				: autoScrambleSentence(item.targetSentence || '');
			const previewChips = previewWords.length > 0
				? previewWords.map(w => `<span style="display:inline-block;background:#EEF0FF;border:1px solid #C5CAE9;color:#1A237E;border-radius:12px;padding:2px 10px;margin:2px 4px 2px 0;font-size:13px;">${escHtml(w)}</span>`).join('')
				: '<span style="color:#999;font-size:13px;">พิมพ์ประโยคเป้าหมายด้านบน — ระบบจะสลับลำดับคำให้อัตโนมัติ</span>';
			fieldsDiv.innerHTML = `
				<div style="margin-bottom:8px;">
					<label style="display:block;margin-bottom:4px;">ประโยคเป้าหมาย: <span style="color:red;">*</span></label>
					<input type="text" class="tense-target" data-uid="${item._uid}" value="${escHtml(item.targetSentence || '')}" 
						placeholder="เช่น I go to school every day" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" />
				</div>
				<div style="margin-bottom:8px;">
					<label style="display:block;margin-bottom:4px;">คำแปลภาษาไทย:</label>
					<input type="text" class="tense-target-th" data-uid="${item._uid}" value="${escHtml(item.sentenceTH || '')}" 
						placeholder="เช่น ฉันไปโรงเรียนทุกวัน" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" />
				</div>
				<div style="margin-bottom:8px;" class="tense-scramble-preview" data-uid="${item._uid}">
					<label style="display:block;margin-bottom:4px;">คำที่สับสน (ระบบสลับให้อัตโนมัติ):</label>
					<div class="tense-scramble-chips" style="background:#fff;border:1px dashed #BDBDBD;border-radius:4px;padding:8px;min-height:38px;">${previewChips}</div>
					<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
						<small style="color:#666;">ผู้เรียนต้องเรียงคำเหล่านี้ให้ถูกต้อง</small>
						<button type="button" class="tense-reshuffle-btn" data-uid="${item._uid}" style="background:#EEF0FF;border:1px solid #5B4FCF;color:#5B4FCF;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer;">สุ่มใหม่</button>
					</div>
				</div>`;
		} else if (item.mode === 'fillBlank') {
			fieldsDiv.innerHTML = `
				<div style="margin-bottom:8px;">
					<label style="display:block;margin-bottom:4px;">ประโยคที่มีช่องว่าง (ใช้ _____ ): <span style="color:red;">*</span></label>
					<input type="text" class="tense-target" data-uid="${item._uid}" value="${escHtml(item.targetSentence || '')}" 
						placeholder="เช่น She _____ to the park yesterday" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" />
				</div>
				<div style="margin-bottom:8px;">
					<label style="display:block;margin-bottom:4px;">คำแปลภาษาไทย:</label>
					<input type="text" class="tense-target-th" data-uid="${item._uid}" value="${escHtml(item.sentenceTH || '')}" 
						placeholder="เช่น หล่อนไปสวนสาธารณะเมื่อวานนี้" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" />
				</div>
				<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
					<div>
						<label style="display:block;margin-bottom:4px;">คำที่หายไป:</label>
						<input type="text" class="tense-missing" data-uid="${item._uid}" value="${escHtml(item.missingWord || '')}" 
							placeholder="เช่น went" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" />
					</div>
					<div>
						<label style="display:block;margin-bottom:4px;">คำตอบที่ถูก: <span style="color:red;">*</span></label>
						<input type="text" class="tense-answer" data-uid="${item._uid}" value="${escHtml(item.correctAnswer || '')}" 
							placeholder="เช่น went" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" />
					</div>
				</div>`;
		} else {
			fieldsDiv.innerHTML = `
				<div style="margin-bottom:8px;">
					<label style="display:block;margin-bottom:4px;">ประโยคให้ฟัง: <span style="color:red;">*</span></label>
					<input type="text" class="tense-target" data-uid="${item._uid}" value="${escHtml(item.targetSentence || '')}" 
						placeholder="เช่น I will visit my friend tomorrow" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" />
					<small style="color:#666;">ผู้เรียนจะฟังประโยคนี้และพูดตาม (สามารถข้ามได้)</small>
				</div>
				<div style="margin-bottom:8px;">
					<label style="display:block;margin-bottom:4px;">คำแปลภาษาไทย:</label>
					<input type="text" class="tense-target-th" data-uid="${item._uid}" value="${escHtml(item.sentenceTH || '')}" 
						placeholder="เช่น ฉันจะไปเยี่ยมเพื่อนพรุ่งนี้" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" />
				</div>`;
		}
		
		card.appendChild(fieldsDiv);
		
		tensesetItemList.appendChild(card);
	});
}

// ── Tense Sets: open / navigation ──
document.getElementById('add-tenseset-btn')?.addEventListener('click', () => {
	openTenseSetModal('add');
});
document.getElementById('add-tenseset-fab')?.addEventListener('click', () => {
	openTenseSetModal('add');
});

document.getElementById('tenseset-back-btn')?.addEventListener('click', closeTenseSetModal);
document.getElementById('tenseset-cancel-btn')?.addEventListener('click', closeTenseSetModal);

tensesetPubToggle?.addEventListener('change', () => {
	document.getElementById('tenseset-toggle-label').textContent = tensesetPubToggle.checked ? 'เผยแพร่ทันที' : 'บันทึกเป็นแบบร่าง';
});

// Wizard navigation (Step 1 → 2)
document.getElementById('tenseset-next-btn-s1')?.addEventListener('click', () => {
	if (!tensesetTitle.value.trim()) {
		tensesetErr.textContent = 'กรุณากรอกชื่อชุด';
		tensesetErr.classList.remove('hidden');
		return;
	}
	tensesetErr.classList.add('hidden');
	setTenseSetStep(2);
});
document.getElementById('tenseset-prev-btn-s2')?.addEventListener('click', () => setTenseSetStep(1));

document.getElementById('tenseset-add-item-btn')?.addEventListener('click', () => {
	if (tensesetItems.length >= 15) {
		alert('เพิ่มได้สูงสุด 15 ข้อ');
		return;
	}
	tensesetItems.push({
		_uid: crypto.randomUUID(),
		mode: 'reorder',
		targetSentence: '',
		sentenceTH: '',
		scrambledWords: [],
		missingWord: '',
		correctAnswer: '',
		tenseIndicator: 'Present',
		ttsVoice: 'female'
	});
	renderTenseSetItems();
});

tensesetItemList?.addEventListener('change', (e) => {
	const uid = e.target.dataset.uid;
	if (!uid) return;
	const item = tensesetItems.find(it => it._uid === uid);
	if (!item) return;

	if (e.target.classList.contains('tense-mode-select')) {
		item.mode = e.target.value;
		renderTenseSetItems();
	} else if (e.target.classList.contains('tense-indicator')) {
		item.tenseIndicator = e.target.value;
	} else if (e.target.classList.contains('tense-voice')) {
		item.ttsVoice = e.target.value;
	}
});

tensesetItemList?.addEventListener('input', (e) => {
	const uid = e.target.dataset.uid;
	if (!uid) return;
	const item = tensesetItems.find(it => it._uid === uid);
	if (!item) return;

	if (e.target.classList.contains('tense-target')) {
		item.targetSentence = e.target.value;
		// โหมดเรียงประโยค: พิมพ์ประโยค → สลับคำอัตโนมัติแบบ live (debounce กันกระพริบ)
		// อัปเดตเฉพาะกล่อง preview ไม่ re-render ทั้งการ์ด (กัน focus หลุดขณะพิมพ์)
		if (item.mode === 'reorder') {
			clearTimeout(item._scrambleTimer);
			const inputEl = e.target;
			item._scrambleTimer = setTimeout(() => {
				if (!inputEl.isConnected) return;
				item.scrambledWords = autoScrambleSentence(item.targetSentence || '');
				const card = tensesetItemList.querySelector('.tense-item-card[data-uid="' + uid + '"]');
				const chipsBox = card ? card.querySelector('.tense-scramble-chips') : null;
				if (chipsBox) {
					chipsBox.innerHTML = item.scrambledWords.length > 0
						? item.scrambledWords.map(w => '<span style="display:inline-block;background:#EEF0FF;border:1px solid #C5CAE9;color:#1A237E;border-radius:12px;padding:2px 10px;margin:2px 4px 2px 0;font-size:13px;">' + escHtml(w) + '</span>').join('')
						: '<span style="color:#999;font-size:13px;">พิมพ์ประโยคเป้าหมายด้านบน — ระบบจะสลับลำดับคำให้อัตโนมัติ</span>';
				}
			}, 400);
		}
	} else if (e.target.classList.contains('tense-target-th')) {
		item.sentenceTH = e.target.value;
	} else if (e.target.classList.contains('tense-missing')) {
		item.missingWord = e.target.value;
	} else if (e.target.classList.contains('tense-answer')) {
		item.correctAnswer = e.target.value;
	}
});

tensesetItemList?.addEventListener('click', (e) => {
	// ปุ่มสุ่มคำใหม่ (โหมดเรียงประโยค) — reshuffle จากประโยคปัจจุบัน
	const reshuffleBtn = e.target.closest('.tense-reshuffle-btn');
	if (reshuffleBtn) {
		const uid = reshuffleBtn.dataset.uid;
		const item = tensesetItems.find(it => it._uid === uid);
		if (item) {
			item.scrambledWords = autoScrambleSentence(item.targetSentence || '');
			const card = tensesetItemList.querySelector('.tense-item-card[data-uid="' + uid + '"]');
			const chipsBox = card ? card.querySelector('.tense-scramble-chips') : null;
			if (chipsBox && item.scrambledWords.length > 0) {
				chipsBox.innerHTML = item.scrambledWords.map(w => '<span style="display:inline-block;background:#EEF0FF;border:1px solid #C5CAE9;color:#1A237E;border-radius:12px;padding:2px 10px;margin:2px 4px 2px 0;font-size:13px;">' + escHtml(w) + '</span>').join('');
			}
		}
		return;
	}
	const deleteBtn = e.target.closest('.tense-delete-btn');
	if (!deleteBtn) return;
	if (tensesetItems.length <= 10) {
		alert('ต้องมีอย่างน้อย 10 ข้อ');
		return;
	}
	const uid = deleteBtn.dataset.uid;
	tensesetItems = tensesetItems.filter(it => it._uid !== uid);
	renderTenseSetItems();
});


// ── Tense Sets: listeners + save handler ──

	document.getElementById('tenseset-save-btn')?.addEventListener('click', async () => {
	tensesetErr.classList.add('hidden');
	
	const title = tensesetTitle.value.trim();
	if (!title) {
		tensesetErr.textContent = 'กรุณากรอกชื่อชุด';
		tensesetErr.classList.remove('hidden');
		return;
	}
	
	if (tensesetItems.length < 10 || tensesetItems.length > 15) {
		tensesetErr.textContent = `ต้องมี 10-15 ข้อ (ปัจจุบัน ${tensesetItems.length} ข้อ)`;
		tensesetErr.classList.remove('hidden');
		return;
	}
	
	for (let i = 0; i < tensesetItems.length; i++) {
		const item = tensesetItems[i];
		if (!item.targetSentence || !item.targetSentence.trim()) {
			tensesetErr.textContent = `ข้อที่ ${i + 1}: กรุณากรอกประโยค`;
			tensesetErr.classList.remove('hidden');
			return;
		}
		if (item.mode === 'fillBlank' && (!item.correctAnswer || !item.correctAnswer.trim())) {
			tensesetErr.textContent = `ข้อที่ ${i + 1}: กรุณากรอกคำตอบที่ถูกต้อง`;
			tensesetErr.classList.remove('hidden');
			return;
		}
	}
	
	// Normalization ก่อนส่ง: default คำตอบ + สร้างคำสลับอัตโนมัติ
	// (backend บังคับ correctAnswer ทุกข้อ — โหมด reorder/listenRepeat ใช้ประโยคเป้าหมายเป็นคำตอบ)
	for (let i = 0; i < tensesetItems.length; i++) {
		const nItem = tensesetItems[i];
		if ((nItem.mode === 'reorder' || nItem.mode === 'listenRepeat') && (!nItem.correctAnswer || !nItem.correctAnswer.trim())) {
			nItem.correctAnswer = (nItem.targetSentence || '').trim();
		}
		if (nItem.mode === 'reorder' && (!nItem.scrambledWords || nItem.scrambledWords.length === 0)) {
			nItem.scrambledWords = autoScrambleSentence(nItem.targetSentence || '');
		}
	}
	
	const items = tensesetItems.map(item => {
		const { _uid, _scrambleTimer, ...rest } = item;
		return rest;
	});
	
	const payload = {
		title,
		tenseTag: tensesetTag.value,
		description: tensesetDesc.value.trim(),
		status: tensesetPubToggle.checked ? 'published' : 'draft',
		items,
		updatedAt: serverTimestamp()
	};
	
	if (!tensesetEditId) {
		payload.createdAt = serverTimestamp();
	}
	
	try {
		const token = await auth.currentUser.getIdToken();
		const url = tensesetEditId 
			? `/api/admin/tense-sets/${tensesetEditId}` 
			: '/api/admin/tense-sets';
		const method = tensesetEditId ? 'PUT' : 'POST';
		
		const res = await fetch(url, {
			method,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Bearer ' + token
			},
			body: JSON.stringify(payload)
		});
		
		const data = await res.json();
		if (!data.success) throw new Error(data.error || 'Save failed');
		
		closeTenseSetModal();
		await loadTenseSets();
		await loadStats();
		alert('✅ บันทึกชุด Tense สำเร็จ!');
	} catch (err) {
		tensesetErr.textContent = 'บันทึกล้มเหลว: ' + err.message;
		tensesetErr.classList.remove('hidden');
	}
});

async function loadTenseSets() {
	const loading = document.getElementById('tenseset-loading');
	const table = document.getElementById('tenseset-table');
	const tbody = document.getElementById('tenseset-tbody');
	loading.classList.remove('hidden'); table.classList.add('hidden');
	try {
		const token = await auth.currentUser.getIdToken();
		const res = await fetch('/api/admin/tense-sets', { headers: { Authorization: 'Bearer ' + token } });
		const data = await res.json();
		if (!data.success) throw new Error(data.error);
		tbody.innerHTML = '';
		let i = 1;
		data.data.forEach((d) => {
			const tr = document.createElement('tr');
			tr.innerHTML = '<td>' + (i++) + '</td><td><strong>' + d.title + '</strong></td><td>' + (d.tenseTag || '—') + '</td><td>' + (d.items ? d.items.length : 0) + '</td><td><span class="status-badge ' + d.status + ' status-toggle" data-id="' + d.id + '" data-status="' + d.status + '">' + (d.status === 'published' ? 'เผยแพร่' : 'ร่าง') + '</span></td><td><button class="btn-edit tenseset-edit-btn" data-id="' + d.id + '">✏️</button><button class="btn-delete tenseset-del-btn" data-id="' + d.id + '">🗑</button></td>';
			tbody.appendChild(tr);
		});
		loading.classList.add('hidden'); table.classList.remove('hidden');
	} catch (err) { loading.textContent = 'โหลดล้มเหลว: ' + err.message; }
}

document.getElementById('tenseset-tbody')?.addEventListener('click', async (e) => {
	const editBtn = e.target.closest('.tenseset-edit-btn');
	const delBtn = e.target.closest('.tenseset-del-btn');
	
	if (editBtn) {
		const id = editBtn.dataset.id;
		try {
			const token = await auth.currentUser.getIdToken();
			const res = await fetch(`/api/admin/tense-sets/${id}`, {
				headers: { Authorization: 'Bearer ' + token }
			});
			const data = await res.json();
			if (!data.success) throw new Error(data.error);
			openTenseSetModal('edit', data.data);
		} catch (err) {
		alert('ออกจากระบบไม่สำเร็จ: ' + err.message);
		}
	}
	
	if (delBtn) {
		if (!confirm('ลบชุด Tense นี้?')) return;
		const id = delBtn.dataset.id;
		try {
			const token = await auth.currentUser.getIdToken();
			const res = await fetch(`/api/admin/tense-sets/${id}`, {
				method: 'DELETE',
				headers: { Authorization: 'Bearer ' + token }
			});
			const data = await res.json();
			if (!data.success) throw new Error(data.error);
			await loadTenseSets();
			await loadStats();
			alert('✅ ลบชุด Tense สำเร็จ');
		} catch (err) {
		alert('ลบไม่สำเร็จ: ' + err.message);
		}
	}
});

// ══════════════════════════════════════════════════════════════════════════
// Admins CRUD
// ══════════════════════════════════════════════════════════════════════════

async function loadAdmins() {
	const loading = document.getElementById('admins-loading');
	const table   = document.getElementById('admins-table');
	const tbody   = document.getElementById('admins-tbody');

	loading.classList.remove('hidden');
	table.classList.add('hidden');

	try {
		const snap = await getDocs(collection(db, 'admins'));
		tbody.innerHTML = '';
		let i = 1;
		snap.forEach((d) => {
			const data   = d.data();
			const isSelf = d.id === auth.currentUser?.email?.toLowerCase();
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td>${i++}</td>
				<td><strong>${d.id}</strong>${isSelf ? ' <span style="color:#5B4FCF;font-size:11px">(you)</span>' : ''}</td>
				<td>${data.name || '—'}</td>
				<td>${data.role || 'admin'}</td>
				<td>${isSelf
					? '<span style="color:#aaa;font-size:12px">Cannot delete self</span>'
					: `<button class="btn-delete admin-delete-btn" data-id="${d.id}">🗑 ลบ</button>`
				}</td>
			`;
			tbody.appendChild(tr);
		});

		loading.classList.add('hidden');
		table.classList.remove('hidden');
	} catch (err) {
		loading.textContent = 'Load failed: ' + err.message;
	}
}

document.getElementById('admins-tbody').addEventListener('click', async (e) => {
	const deleteBtn = e.target.closest('.admin-delete-btn');
	if (!deleteBtn) return;
	const id = deleteBtn.dataset.id;
	if (!confirm(`Delete admin "${id}" ?\nThis admin will no longer be able to sign in`)) return;
	try {
		await deleteDoc(doc(db, 'admins', id));
		await loadAdmins();
		await loadStats();
	} catch (err) {
		alert('Delete failed: ' + err.message);
	}
});

// Add admin modal
const adminModal     = document.getElementById('admin-modal');
const adminEmailInp  = document.getElementById('admin-email-inp');
const adminNameInp   = document.getElementById('admin-name-inp');
const adminRoleInp   = document.getElementById('admin-role-inp');
const adminError     = document.getElementById('admin-error');
const adminSaveBtn   = document.getElementById('admin-save-btn');
const adminCancelBtn = document.getElementById('admin-cancel-btn');

document.getElementById('add-admin-btn').addEventListener('click', () => {
	adminEmailInp.value = '';
	adminNameInp.value  = '';
	adminRoleInp.value  = 'admin';
	adminError.classList.add('hidden');
	adminModal.classList.remove('hidden');
});

adminCancelBtn.addEventListener('click', () => adminModal.classList.add('hidden'));
adminModal.addEventListener('click', (e) => { if (e.target === adminModal) adminModal.classList.add('hidden'); });

adminSaveBtn.addEventListener('click', async () => {
	const email = adminEmailInp.value.trim().toLowerCase();
	const name  = adminNameInp.value.trim();
	const role  = adminRoleInp.value.trim() || 'admin';
	adminError.classList.add('hidden');

	if (!email || !email.includes('@')) {
		adminError.textContent = 'Please enter a valid email';
		adminError.classList.remove('hidden');
		return;
	}

	try {
		const existing = await getDoc(doc(db, 'admins', email));
		if (existing.exists()) {
			adminError.textContent = 'An admin with this email already exists';
			adminError.classList.remove('hidden');
			return;
		}
		await setDoc(doc(db, 'admins', email), {
			name,
			role,
			createdAt: serverTimestamp(),
		});
		adminModal.classList.add('hidden');
		await loadAdmins();
		await loadStats();
	} catch (err) {
		adminError.textContent = 'Save failed: ' + err.message;
		adminError.classList.remove('hidden');
	}
});

// ── Vocabulary Sets: setup (Decoupled: Matching Master → FillBlank Dependent) ──
const vocabsetEditSection = document.getElementById('section-vocabset-edit');
const vocabsetSection = document.getElementById('section-vocabulary');
const vocabsetTitle = document.getElementById('vocabset-title');
const vocabsetDesc = document.getElementById('vocabset-description');
const vocabsetPubToggle = document.getElementById('vocabset-publish-toggle');
const vocabsetPageTitle = document.getElementById('vocabset-page-title');
const vocabsetErr = document.getElementById('vocabset-error');
const vocabsetItemList = document.getElementById('vocabset-item-editor-list'); // Step 1 ? Master pairs
const vocabsetFibList = document.getElementById('vocabset-fib-list');           // Step 2 ? Dependent sentences
const vocabsetCount = document.getElementById('vocabset-item-count');
const vocabsetFibCount = document.getElementById('vocabset-fib-count');

let vocabsetItems = [];          // Module 1 (MASTER): {wordEN, wordTH, ...} โ€” source of truth
let vocabsetSentenceRows = [];   // Module 4 (FIB): {linkIdx, sentence, sentenceTH}
let vocabsetStep = 1;
let vocabsetEditSpellingWords = [];    // pre-check state when editing: array of wordEN strings
let vocabsetEditListenWords = [];      // pre-check state when editing: array of wordEN strings
let vocabsetEditId = null;

// ── Vocab-library autocomplete for Step 1 (Master) EN inputs ───────────────
// ดึงคำศัพท์จาก collection `vocabulary` (คลังคำศัพท์) มาเป็น suggestion.
// พิมพ์ "a" → แสดงคำที่ขึ้นต้นด้วย a, พิมพ์ต่อ "ap" → รายการแคบลง (prefix match).
// เลือกแล้วเติม wordTH ให้อัตโนมัติ (แก้ทับได้), พิมพ์คำใหม่เองได้เสมอ.
let vocabSuggestCache = [];      // [{ wordEN, wordTH }]
let vocabSuggestLoaded = false;
let vocabSuggestLoading = null;  // promise กันโหลดซ้ำ
let vocabSuggestActiveIdx = -1;  // row ที่เปิด dropdown อยู่

async function ensureVocabSuggestCache() {
	if (vocabSuggestLoaded) return vocabSuggestCache;
	if (vocabSuggestLoading) return vocabSuggestLoading;
	vocabSuggestLoading = (async () => {
		try {
			// ใช้ข้อมูลที่โหลดไว้แล้วก่อน (ถ้าเคยเปิดเมนูคลังคำศัพท์) กันอ่าน Firestore ซ้ำ
			if (Array.isArray(allVocabRows) && allVocabRows.length > 0) {
				vocabSuggestCache = allVocabRows
					.filter(v => v && (v.wordEN || '').trim())
					.map(v => ({ wordEN: String(v.wordEN).trim(), wordTH: String(v.wordTH || '').trim() }));
			} else {
				const snap = await getDocs(collection(db, 'vocabulary'));
				vocabSuggestCache = snap.docs
					.map(d => d.data())
					.filter(v => v && (v.wordEN || '').trim())
					.map(v => ({ wordEN: String(v.wordEN).trim(), wordTH: String(v.wordTH || '').trim() }));
			}
			vocabSuggestCache.sort((a, b) => a.wordEN.toLowerCase().localeCompare(b.wordEN.toLowerCase()));
		} catch (err) {
			console.error('[vocabSuggest] load failed:', err.message);
			vocabSuggestCache = [];
		}
		vocabSuggestLoaded = true;
		vocabSuggestLoading = null;
		return vocabSuggestCache;
	})();
	return vocabSuggestLoading;
}

// รีเฟรช cache หลังแก้ไขคลังคำศัพท์ (เรียกจาก loadVocab)
function invalidateVocabSuggestCache() {
	vocabSuggestLoaded = false;
	vocabSuggestCache = [];
	vocabSuggestLoading = null;
}

function getVocabSuggestMatches(prefix) {
	const q = (prefix || '').trim().toLowerCase();
	if (!q) return [];
	return vocabSuggestCache
		.filter(v => v.wordEN.toLowerCase().startsWith(q))
		.slice(0, 8);
}

function closeAllPairSuggest() {
	vocabsetItemList.querySelectorAll('.pair-suggest-list').forEach(el => el.classList.add('hidden'));
	vocabSuggestActiveIdx = -1;
}

function renderPairSuggest(idx, matches) {
	const row = vocabsetItemList.querySelector('.pair-row[data-idx="' + idx + '"]');
	if (!row) return;
	const list = row.querySelector('.pair-suggest-list');
	if (!list) return;
	if (!matches.length) {
		list.classList.add('hidden');
		list.innerHTML = '';
		if (vocabSuggestActiveIdx === idx) vocabSuggestActiveIdx = -1;
		return;
	}
	list.innerHTML = matches.map((m) =>
		'<button type="button" class="pair-suggest-item" data-idx="' + idx + '"'
		+ ' data-en="' + escHtml(m.wordEN) + '" data-th="' + escHtml(m.wordTH) + '">'
		+ '<strong>' + escHtml(m.wordEN) + '</strong>'
		+ '<span>' + escHtml(m.wordTH || '—') + '</span>'
		+ '</button>'
	).join('');
	list.classList.remove('hidden');
	vocabSuggestActiveIdx = idx;
}

function showVocabSetEdit() {
	vocabsetSection.classList.add('hidden');
	vocabsetEditSection.classList.remove('hidden');
	showVocabStep(1); // always open on Step 1 (Matching) for review
}
function hideVocabSetEdit() {
	vocabsetSection.classList.remove('hidden');
	vocabsetEditSection.classList.add('hidden');
}

// ════ Multi-step navigation (4 Steps) ════════════════════════════════════
function showVocabStep(n) {
	vocabsetStep = n;
	// Show/hide step panes
	document.getElementById('vocabset-step-1').classList.toggle('hidden', n !== 1);
	document.getElementById('vocabset-step-2').classList.toggle('hidden', n !== 2);
	document.getElementById('vocabset-step-3').classList.toggle('hidden', n !== 3);
	document.getElementById('vocabset-step-4').classList.toggle('hidden', n !== 4);
	// Update stepper indicators
	document.getElementById('wiz-ind-1').classList.toggle('active', n === 1);
	document.getElementById('wiz-ind-1').classList.toggle('done', n > 1);
	document.getElementById('wiz-ind-2').classList.toggle('active', n === 2);
	document.getElementById('wiz-ind-2').classList.toggle('done', n > 2);
	document.getElementById('wiz-ind-3').classList.toggle('active', n === 3);
	document.getElementById('wiz-ind-3').classList.toggle('done', n > 3);
	document.getElementById('wiz-ind-4').classList.toggle('active', n === 4);
	// Render content for each step
	if (n === 2) renderSpellingWordList();       // Step 2 = Spelling
	if (n === 3) renderListenWordList();          // Step 3 = Listen & Repeat
	if (n === 4) renderVocabSetSentences();       // Step 4 = Fill-in-blank
}

function newVocabSetItem() {
	return { wordEN:'', wordTH:'', sentence:'', sentenceTH:'', ttsVoice:'female', playbackSpeed:1.0, distractors:[] };
}

// ════ Step 2: Spelling word list ════════════════════════════════════════════
function renderSpellingWordList() {
	const container = document.getElementById('vocabset-spelling-items');
	if (!container) return;
	container.innerHTML = '';

	const pairs = vocabsetItems.filter(it => it && it.wordEN && it.wordTH &&
		it.wordEN.trim() && it.wordTH.trim());

	if (pairs.length === 0) {
		container.innerHTML = '<div style="padding:20px;text-align:center;color:#888;font-size:14px;">' +
			'ยังไม่มีคำศัพท์ — กรุณากรอกคำศัพท์ใน Step 1 ก่อน</div>';
		updateSpellingCount();
		return;
	}

	pairs.forEach((pair, index) => {
		const div = document.createElement('div');
		div.className = 'spelling-item';
		div.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px;border-bottom:1px solid #eee;';

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.id = 'spelling-word-' + index;
		checkbox.style.cssText = 'width:20px;cursor:pointer;';
		checkbox.dataset.wordEN = pair.wordEN;
		checkbox.dataset.wordTH = pair.wordTH;
		// Pre-check if this word was saved before (edit mode)
		if (vocabsetEditSpellingWords.includes(pair.wordEN)) checkbox.checked = true;
		checkbox.addEventListener('change', updateSpellingCount);

		const labelEN = document.createElement('span');
		labelEN.textContent = pair.wordEN.toLowerCase();
		labelEN.style.cssText = 'flex:1;font-weight:500;';

		const labelTH = document.createElement('span');
		labelTH.textContent = pair.wordTH;
		labelTH.style.cssText = 'flex:1;color:#666;';

		div.appendChild(checkbox);
		div.appendChild(labelEN);
		div.appendChild(labelTH);
		container.appendChild(div);
	});

	updateSpellingCount();
}

function updateSpellingCount() {
	const checked = document.querySelectorAll('#vocabset-spelling-items input[type="checkbox"]:checked').length;
	const el = document.getElementById('vocabset-spelling-count');
	if (el) el.textContent = checked;
}

function getSelectedSpellingWords() {
	const checkboxes = document.querySelectorAll('#vocabset-spelling-items input[type="checkbox"]:checked');
	return Array.from(checkboxes).map(cb => ({
		wordEN: (cb.dataset.wordEN || '').trim(),
		wordTH: (cb.dataset.wordTH || '').trim(),
	}));
}

function resetVocabSetForm() {
	vocabsetEditId = null;
	vocabsetEditSpellingWords = [];
	vocabsetEditListenWords = [];
	vocabsetPageTitle.textContent = 'สร้างชุดคำศัพท์';
	vocabsetTitle.value = '';
	vocabsetDesc.value = '';
	vocabsetPubToggle.checked = false;
	document.getElementById('vocabset-toggle-label').textContent = 'บันทึกเป็นแบบร่าง';
	vocabsetErr.classList.add('hidden');
	vocabsetItems = [];
	vocabsetSentenceRows = [];
	for (let i = 0; i < 4; i++) {
		vocabsetItems.push(newVocabSetItem());
		vocabsetSentenceRows.push({ linkIdx: i, sentence: '', sentenceTH: '' });
	}
	renderVocabSetPairs();
	showVocabStep(1);
	showVocabSetEdit();
}

document.getElementById('add-vocabset-btn').addEventListener('click', resetVocabSetForm);

document.getElementById('vocabset-back-btn').addEventListener('click', hideVocabSetEdit);
document.getElementById('vocabset-cancel-btn').addEventListener('click', hideVocabSetEdit);
vocabsetPubToggle.addEventListener('change', () => {
	document.getElementById('vocabset-toggle-label').textContent = vocabsetPubToggle.checked ? 'เผยแพร่ทันที' : 'บันทึกเป็นแบบร่าง';
});

// ─── Module 1 — Matching Setup (MASTER) ─────────────────────
function renderVocabSetPairs() {
	vocabsetItemList.innerHTML = '';
	closeAllPairSuggest();
	vocabsetCount.textContent = String(vocabsetItems.length);
	vocabsetItems.forEach((it, idx) => {
		const row = document.createElement('div');
		row.className = 'pair-row';
		row.dataset.idx = String(idx);
		row.innerHTML = '<span class="pair-num">' + (idx + 1) + '</span>'
			+ '<div class="pair-suggest-wrap">'
			+ '<input type="text" data-field="wordEN" value="' + escHtml(it.wordEN || '') + '" placeholder="apple" autocomplete="off" />'
			+ '<div class="pair-suggest-list hidden"></div>'
			+ '</div>'
			+ '<span class="pair-arrow" aria-hidden="true">→</span>'
			+ '<input type="text" data-field="wordTH" value="' + escHtml(it.wordTH || '') + '" placeholder="แอปเปิ้ล" />'
			+ '<button type="button" class="pair-delete-btn" data-idx="' + idx + '">ลบ</button>';
		vocabsetItemList.appendChild(row);
	});
	// โหลดคลังคำศัพท์ล่วงหน้า (ครั้งเดียว) เพื่อให้ autocomplete พร้อมใช้ทันที
	ensureVocabSuggestCache();
}

document.getElementById('vocabset-add-item-btn').addEventListener('click', () => {
	if (vocabsetItems.length >= 15) { alert('เพิ่มได้สูงสุด 15 ข้อ'); return; }
	vocabsetItems.push(newVocabSetItem());
	vocabsetSentenceRows.push({ linkIdx: vocabsetItems.length - 1, sentence: '', sentenceTH: '' });
	renderVocabSetPairs();
	renderVocabSetSentences();
});

// Capture master pair edits directly into vocabsetItems + EN autocomplete.
let vocabSuggestDebounce = null;
vocabsetItemList.addEventListener('input', (e) => {
	const row = e.target.closest('.pair-row');
	if (!row) return;
	const field = e.target.dataset.field;
	if (!field) return;
	const idx = parseInt(row.dataset.idx, 10);
	if (vocabsetItems[idx]) vocabsetItems[idx][field] = e.target.value;
	// Autocomplete เฉพาะช่อง EN: กรองแบบ prefix + debounce กันกระพริบ
	if (field !== 'wordEN' || !e.target.isConnected) return;
	clearTimeout(vocabSuggestDebounce);
	const inputEl = e.target;
	vocabSuggestDebounce = setTimeout(async () => {
		await ensureVocabSuggestCache();
		if (!inputEl.isConnected) return; // แถวถูกลบ/re-render ระหว่างรอ → ทิ้ง
		renderPairSuggest(idx, getVocabSuggestMatches(inputEl.value));
	}, 150);
});

// โฟกัสช่อง EN → แสดง suggestion ของค่าปัจจุบันทันที (ถ้ามี)
vocabsetItemList.addEventListener('focusin', async (e) => {
	if (e.target.dataset.field !== 'wordEN') return;
	const row = e.target.closest('.pair-row');
	if (!row) return;
	const idx = parseInt(row.dataset.idx, 10);
	await ensureVocabSuggestCache();
	if (!e.target.isConnected) return;
	renderPairSuggest(idx, getVocabSuggestMatches(e.target.value));
});

// Esc ในช่อง EN → ปิด dropdown
vocabsetItemList.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') closeAllPairSuggest();
});

// เลือก suggestion → เติม EN + TH ให้อัตโนมัติ (แก้ทับได้ทีหลัง)
// หมายเหตุ: ใช้ mousedown + preventDefault แทน click เพราะ document-level
// 'click → closeAllPairSuggest' จะปิด dropdown ก่อน click event มาถึงปุ่ม
vocabsetItemList.addEventListener('mousedown', (e) => {
	const item = e.target.closest('.pair-suggest-item');
	if (!item) return;
	e.preventDefault(); // กัน input blur ก่อนอ่านค่า
	const idx = parseInt(item.dataset.idx, 10);
	const en = item.dataset.en || '';
	const th = item.dataset.th || '';
	if (vocabsetItems[idx]) {
		vocabsetItems[idx].wordEN = en;
		if (th) vocabsetItems[idx].wordTH = th;
	}
	const row = vocabsetItemList.querySelector('.pair-row[data-idx="' + idx + '"]');
	if (row) {
		const enInput = row.querySelector('input[data-field="wordEN"]');
		const thInput = row.querySelector('input[data-field="wordTH"]');
		if (enInput) enInput.value = en;
		if (thInput && th) thInput.value = th;
	}
	closeAllPairSuggest();
});

// คลิกนอกแถว → ปิด dropdown (ผูกครั้งเดียว กัน listener ซ้ำ)
// หมายเหตุ: ใช้ 'mousedown' แทน 'click' เพื่อไม่ให้ชนกับ handler เลือก suggestion
// (mousedown เกิดก่อน focus/blur — ถ้าคลิกบน suggestion จะถูกข้ามเพราะอยู่ใน wrap)
if (!vocabsetItemList.dataset.suggestOutsideBound) {
	vocabsetItemList.dataset.suggestOutsideBound = '1';
	document.addEventListener('mousedown', (ev) => {
		if (!ev.target.closest || !ev.target.closest('.pair-suggest-wrap')) closeAllPairSuggest();
	});
}

vocabsetItemList.addEventListener('click', (e) => {
	const delBtn = e.target.closest('.pair-delete-btn');
	if (!delBtn) return;
	if (vocabsetItems.length <= 4) { alert('ต้องมีอย่างน้อย 4 คู่'); return; }
	const idx = parseInt(delBtn.dataset.idx, 10);
	vocabsetItems.splice(idx, 1);
	// Drop sentence rows linked to the deleted pair; re-index links above it.
	vocabsetSentenceRows = vocabsetSentenceRows
		.filter((r) => r.linkIdx !== idx)
		.map((r) => (r.linkIdx > idx ? { ...r, linkIdx: r.linkIdx - 1 } : r));
	renderVocabSetPairs();
	renderVocabSetSentences();
});

document.getElementById('vocabset-next-btn').addEventListener('click', () => {
	vocabsetErr.classList.add('hidden');
	if (vocabsetItems.length < 4 || vocabsetItems.length > 15) {
		showVocabSetError('ต้องมี 4-15 คู่ (ปัจจุบัน ' + vocabsetItems.length + ' คู่)'); return;
	}
	for (let i = 0; i < vocabsetItems.length; i++) {
		if (!(vocabsetItems[i].wordEN || '').trim() || !(vocabsetItems[i].wordTH || '').trim()) {
			showVocabSetError('คู่ที่ ' + (i + 1) + ': ต้องกรอกคำศัพท์ (EN) และคำแปล (TH) ก่อนไปขั้นตอนถัดไป');
			return;
		}
	}
	showVocabStep(2);
});

// Step 2 Next button handler (goes to Step 3 - Listen & Repeat)
document.getElementById('vocabset-next-btn-s2').addEventListener('click', () => {
	vocabsetErr.classList.add('hidden');
	showVocabStep(3);
});

// Step 3 Back button handler (goes back to Step 2)
document.getElementById('vocabset-prev-btn-s3').addEventListener('click', () => {
	showVocabStep(2);
});

// Step 3 Next button handler (goes to Step 4 - Fill-in-blank)
document.getElementById('vocabset-next-btn-s3').addEventListener('click', () => {
	vocabsetErr.classList.add('hidden');
	showVocabStep(4);
});

// Step 4 Back button handler (goes back to Step 3)
document.getElementById('vocabset-prev-btn-s4').addEventListener('click', () => {
	showVocabStep(3);
});

// ════ renderListenWordList — Step 3: Listen & Repeat ═══════════════════════
function renderListenWordList() {
	const container = document.getElementById('vocabset-listen-items');
	if (!container) return;
	container.innerHTML = '';

	const pairs = vocabsetItems.filter(it => it && it.wordEN && it.wordTH &&
		it.wordEN.trim() && it.wordTH.trim());

	if (pairs.length === 0) {
		container.innerHTML = '<div style="padding:20px;text-align:center;color:#888;font-size:14px;">' +
			'ยังไม่มีคำศัพท์ — กรุณากรอกคำศัพท์ใน Step 1 ก่อน</div>';
		updateListenCount();
		return;
	}

	pairs.forEach((pair, index) => {
		const div = document.createElement('div');
		div.className = 'spelling-item';
		div.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px;border-bottom:1px solid #eee;';

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.id = 'listen-word-' + index;
		checkbox.style.cssText = 'width:20px;cursor:pointer;';
		checkbox.dataset.wordEN = pair.wordEN;
		checkbox.dataset.wordTH = pair.wordTH;
		// Pre-check if this word was saved before (edit mode)
		if (vocabsetEditListenWords.includes(pair.wordEN)) checkbox.checked = true;
		checkbox.addEventListener('change', updateListenCount);

		const labelEN = document.createElement('span');
		labelEN.textContent = pair.wordEN.toLowerCase();
		labelEN.style.cssText = 'flex:1;font-weight:500;';

		const labelTH = document.createElement('span');
		labelTH.textContent = pair.wordTH;
		labelTH.style.cssText = 'flex:1;color:#666;';

		div.appendChild(checkbox);
		div.appendChild(labelEN);
		div.appendChild(labelTH);
		container.appendChild(div);
	});

	updateListenCount();
}

function updateListenCount() {
	const checked = document.querySelectorAll('#vocabset-listen-items input[type="checkbox"]:checked').length;
	const el = document.getElementById('vocabset-listen-count');
	if (el) el.textContent = checked;
}

// Trim like items[] (save handler trims wordEN/wordTH) so stored lists match
function getSelectedListenWords() {
	const checkboxes = document.querySelectorAll('#vocabset-listen-items input[type="checkbox"]:checked');
	return Array.from(checkboxes).map(cb => ({
		wordEN: (cb.dataset.wordEN || '').trim(),
		wordTH: (cb.dataset.wordTH || '').trim(),
	}));
}

async function createSpellingExercises(vocabSetId, spellingWords) {
	// Stub โ€” spelling words are stored in the vocab-set payload itself
	console.log('spellingWords saved in payload for vocabSet:', vocabSetId, spellingWords.length);
}

// ─── Module 2 — Fill-in-the-blank Setup (DEPENDENT, references Master) ──
function renderVocabSetSentences() {
	vocabsetFibList.innerHTML = '';
	vocabsetFibCount.textContent = String(vocabsetSentenceRows.length);
	vocabsetSentenceRows.forEach((r, k) => {
		const row = document.createElement('div');
		row.className = 'fib-row';
		row.dataset.row = String(k);
		row.innerHTML = '<span class="pair-num">' + (k + 1) + '</span>'
			+ '<select class="fib-word-select" data-row="' + k + '" title="เลือกคำศัพท์จากรายการ">'
			+ buildFibWordOptions(r.linkIdx, usedFibIndicesExcept(k))
			+ '</select>'
			+ '<input type="text" data-row="' + k + '" data-field="sentence" value="' + (r.sentence || '') + '" placeholder="I eat an apple every day." />'
			+ '<input type="text" data-row="' + k + '" data-field="sentenceTH" value="' + (r.sentenceTH || '') + '" placeholder="ฉันกินแอปเปิ้ลทุกวัน" />';
		const delBtn = document.createElement('button');
		delBtn.type = 'button';
		delBtn.className = 'fib-delete-btn pair-delete-btn';
		delBtn.dataset.row = String(k);
		delBtn.textContent = 'ลบ';
		row.appendChild(delBtn);
		vocabsetFibList.appendChild(row);
	});
}

// Populates <option> for every master word (value = master item index).
// usedIdxs = Set ของ index ที่แถวอื่นเลือกอยู่ → option เหล่านั้น disabled (กันเลือกคำศัพท์ซ้ำข้ามแถว)
function buildFibWordOptions(selectedIdx, usedIdxs) {
	const used = usedIdxs || new Set();
	let opts = '<option value="-1" disabled' + (selectedIdx < 0 || !vocabsetItems[selectedIdx] ? ' selected' : '') + '>— เลือกคำศัพท์ (EN) —</option>';
	vocabsetItems.forEach((it, idx) => {
		const label = (it.wordEN || '').trim();
		const sel = idx === selectedIdx ? ' selected' : '';
		const taken = used.has(idx) && idx !== selectedIdx;
		if (!label) {
			opts += '<option value="' + idx + '" disabled>ข้อ ' + (idx + 1) + ': ยังไม่กรอก EN</option>';
		} else {
			opts += '<option value="' + idx + '"' + sel + (taken ? ' disabled' : '') + '>' + label + ' — ข้อ ' + (idx + 1) + (taken ? ' (ใช้แล้ว)' : '') + '</option>';
		}
	});
	return opts;
}

// รวม index คำศัพท์ที่แถวอื่น (ไม่รวม exceptRow) เลือกอยู่ — สำหรับปิดตัวเลือกซ้ำ
function usedFibIndicesExcept(exceptRow) {
	const used = new Set();
	vocabsetSentenceRows.forEach((o, j) => { if (j !== exceptRow && o.linkIdx >= 0) used.add(o.linkIdx); });
	return used;
}

vocabsetFibList.addEventListener('input', (e) => {
	const row = e.target.closest('.fib-row');
	if (!row) return;
	const field = e.target.dataset.field;
	if (!field) return;
	const k = parseInt(row.dataset.row, 10);
	if (vocabsetSentenceRows[k]) vocabsetSentenceRows[k][field] = e.target.value;
});

// Dropdown change links the sentence row to the chosen master word.
vocabsetFibList.addEventListener('change', (e) => {
	const sel = e.target.closest('.fib-word-select');
	if (!sel) return;
	const k = parseInt(sel.dataset.row, 10);
	if (vocabsetSentenceRows[k]) vocabsetSentenceRows[k].linkIdx = parseInt(sel.value, 10);
	// คำที่ "ใช้แล้ว" เปลี่ยนไป → รีเฟรช option list ของทุก select ให้สถานะ disabled ถูกต้อง
	vocabsetFibList.querySelectorAll('.fib-word-select').forEach((el) => {
		const rk = parseInt(el.dataset.row, 10);
		const r = vocabsetSentenceRows[rk];
		if (!r) return;
		el.innerHTML = buildFibWordOptions(r.linkIdx, usedFibIndicesExcept(rk));
	});
});

// Add new FIB sentence row (Step 4)
document.getElementById('vocabset-add-fib-btn').addEventListener('click', () => {
	if (vocabsetSentenceRows.length >= 30) {
		alert('เติมคำในช่องว่างได้สูงสุด 30 ข้อ');
		return;
	}
	vocabsetSentenceRows.push({ linkIdx: -1, sentence: '', sentenceTH: '' });
	renderVocabSetSentences();
});

// Delete FIB sentence row (Step 4)
vocabsetFibList.addEventListener('click', (e) => {
	const delBtn = e.target.closest('.fib-delete-btn');
	if (!delBtn) return;
	const k = parseInt(delBtn.dataset.row, 10);
	if (vocabsetSentenceRows.length <= 1) {
		alert('ต้องเก็บอย่างน้อย 1 ข้อสอบ');
		return;
	}
	vocabsetSentenceRows.splice(k, 1);
	renderVocabSetSentences();
});

document.getElementById('vocabset-prev-btn').addEventListener('click', () => showVocabStep(1));

document.getElementById('vocabset-save-btn').addEventListener('click', async () => {
	vocabsetErr.classList.add('hidden');
	const title = vocabsetTitle.value.trim();
	if (!title) { showVocabSetError('กรุณากรอกชื่อชุด'); return; }
	if (vocabsetItems.length < 4 || vocabsetItems.length > 15) {
		showVocabSetError('ต้องมี 4-15 ข้อ (ปัจจุบัน ' + vocabsetItems.length + ' ข้อ)'); return;
	}

	// Build master items array (Step 1 - Matching)
	const items = vocabsetItems.map((it) => ({
		wordEN: ((it.wordEN || '').trim()).toLowerCase(),
		wordTH: (it.wordTH || '').trim(),
		sentence: '',
		sentenceTH: '',
		ttsVoice: 'female',
		playbackSpeed: 1.0,
		distractors: [],
	}));
	for (let i = 0; i < items.length; i++) {
		if (!items[i].wordEN || !items[i].wordTH) {
			showVocabSetError('ข้อที่ ' + (i + 1) + ': ต้องกรอกคำศัพท์ (EN) และคำแปล (TH)'); return;
		}
	}

	// Collect Step 4 - Fill-in-the-blank sentences (FIB)
	// ห้ามใช้คำศัพท์ซ้ำข้ามประโยค (1 คำ = 1 ประโยค) และประโยคต้องไม่ซ้ำกัน
	const fillInBlankSentences = [];
	const seenFibSentences = new Set();
	const seenFibWords = new Set();
	for (let i = 0; i < vocabsetSentenceRows.length; i++) {
		const r = vocabsetSentenceRows[i];
		const target = items[r.linkIdx];
		const s = (r.sentence || '').trim();
		const st = (r.sentenceTH || '').trim();
		if (!target) {
			if (s || st) { showVocabSetError('ข้อที่ ' + (i + 1) + ': ต้องเลือกคำศัพท์ (EN) สำหรับประโยคที่กรอกแล้ว'); return; }
			continue;
		}
		if (!s && !st) continue;
		if (!target.wordEN) { showVocabSetError('ข้อที่ ' + (i + 1) + ': ต้องเลือกคำศัพท์ (EN) สำหรับประโยคเติมคำในช่องว่าง'); return; }
		if (s && s.toLowerCase().indexOf(target.wordEN.toLowerCase()) === -1) {
			showVocabSetError('ข้อที่ ' + (i + 1) + ': ประโยคภาษาอังกฤษต้องมีคำว่า "' + target.wordEN + '" อยู่ในประโยค ตัวอย่าง: "I like ' + target.wordEN + ' very much."');
			return;
		}
		const wordKey = target.wordEN.toLowerCase();
		if (seenFibWords.has(wordKey)) {
			showVocabSetError('ข้อที่ ' + (i + 1) + ': คำศัพท์ "' + target.wordEN + '" ถูกเลือกซ้ำ — แต่ละคำศัพท์ใช้ได้ 1 ประโยค');
			return;
		}
		seenFibWords.add(wordKey);
		const key = (s || st).toLowerCase();
		if (seenFibSentences.has(key)) {
			showVocabSetError('ข้อที่ ' + (i + 1) + ': ประโยคซ้ำกัน: "' + (s || st) + '" — กรุณาใช้ประโยคที่ไม่ซ้ำกัน');
			return;
		}
		seenFibSentences.add(key);
		fillInBlankSentences.push({ wordEN: target.wordEN, wordTH: target.wordTH, sentence: s, sentenceTH: st });

		// ยังคง overlay ลง items เพื่อ backward compatibility กับชุด/ไคลเอนต์เดิม
		target.sentence = s;
		target.sentenceTH = st;
	}

	// Collect Step 2 - Spelling words (checkboxes)
	const spellingWords = getSelectedSpellingWords();

	// Collect Step 3 - Listen & Repeat words (checkboxes)
	const listenRepeatWords = getSelectedListenWords();

	const payload = {
		title,
		level: 'A1',
		description: vocabsetDesc.value.trim(),
		ttsSystem: 'female',
		playbackSpeed: 1.0,
		status: vocabsetPubToggle.checked ? 'published' : 'draft',
		items,
		spellingWords,
		listenRepeatWords,
		fillInBlankSentences,
	};

	try {
		const token = await auth.currentUser.getIdToken();
		const url = vocabsetEditId ? '/api/admin/vocabulary-sets/' + vocabsetEditId : '/api/admin/vocabulary-sets';
		const res = await fetch(url, {
			method: vocabsetEditId ? 'PUT' : 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
			body: JSON.stringify(payload)
		});
		const data = await res.json();
		if (!data.success) throw new Error(data.error);
		await loadVocabSets();
		hideVocabSetEdit();
		alert('✅ บันทึกชุดคำศัพท์สำเร็จ!');
	} catch (err) { showVocabSetError('บันทึกล้มเหลว: ' + err.message); }
});

function showVocabSetError(msg) { vocabsetErr.textContent = msg; vocabsetErr.classList.remove('hidden'); }

document.getElementById('vocabset-tbody').addEventListener('click', async (e) => {
	const editBtn = e.target.closest('.vocabset-edit-btn');
	const delBtn = e.target.closest('.vocabset-del-btn');
	if (delBtn) {
		if (!confirm('ลบชุดคำศัพท์นี้?')) return;
		try { const token = await auth.currentUser.getIdToken(); await fetch('/api/admin/vocabulary-sets/' + delBtn.dataset.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); await loadVocabSets(); }
		catch (err) { alert('ลบล้มเหลว: ' + err.message); }
	}
	if (editBtn) {
		try {
			const token = await auth.currentUser.getIdToken();
			const res = await fetch('/api/admin/vocabulary-sets', { headers: { Authorization: 'Bearer ' + token } });
			const data = await res.json();
			const set = data.data.find((s) => s.id === editBtn.dataset.id);
			if (!set) return;
			vocabsetEditId = set.id;
			vocabsetPageTitle.textContent = 'แก้ไขชุดคำศัพท์';
			vocabsetTitle.value = set.title || '';
			vocabsetDesc.value = set.description || '';
			vocabsetPubToggle.checked = set.status === 'published';
			document.getElementById('vocabset-toggle-label').textContent = set.status === 'published' ? 'เผยแพร่ทันที' : 'บันทึกเป็นแบบร่าง';
			vocabsetItems = (set.items || []).map((it) => ({ ...it }));
			while (vocabsetItems.length < 4) vocabsetItems.push(newVocabSetItem());
			vocabsetSentenceRows = vocabsetItems.map((it, i) => ({
				linkIdx: i,
				sentence: (it.sentence || ''),
				sentenceTH: (it.sentenceTH || '')
			}));
			// Store saved spelling/listen words to pre-check after render
			vocabsetEditSpellingWords = (set.spellingWords || []).map(w => w.wordEN);
			vocabsetEditListenWords = (set.listenRepeatWords || []).map(w => w.wordEN);
			renderVocabSetPairs();
			showVocabSetEdit(); // opens on Step 1 (Matching) for review
		} catch (err) { alert('โหลดข้อมูลล้มเหลว: ' + err.message); }
	}
});

// ── Listening/Reading Sets: setup ───────────────────────────────────────
const lrsetModal = document.getElementById('lrset-modal');
const lrsetTitle = document.getElementById('lrset-title');
const lrsetLevel = document.getElementById('lrset-level');
const lrsetDesc = document.getElementById('lrset-description');
const lrsetSpeakerAName = document.getElementById('lrset-speakerA-name');
const lrsetSpeakerATts = document.getElementById('lrset-speakerA-tts');
const lrsetSpeakerBName = document.getElementById('lrset-speakerB-name');
const lrsetSpeakerBTts = document.getElementById('lrset-speakerB-tts');
const lrsetPubToggle = document.getElementById('lrset-publish-toggle');
const lrsetErr = document.getElementById('lrset-error');
const lrsetDialogueList = document.getElementById('lrset-dialogue-editor-list');
const lrsetQuestionList = document.getElementById('lrset-questions-editor-list');
const lrsetDialogueCount = document.getElementById('lrset-dialogue-count');
const lrsetChatPreview = document.getElementById('lrset-chat-preview');
let lrsetDialogue = [];
let lrsetQuestions = [];
let lrsetEditId = null;

document.getElementById('add-lrset-btn').addEventListener('click', () => {
	lrsetEditId = null;
	lrsetTitle.value = '';
	lrsetLevel.value = 'A2';
	lrsetDesc.value = '';
	lrsetSpeakerAName.value = 'Speaker A';
	lrsetSpeakerATts.value = 'male';
	lrsetSpeakerBName.value = 'Speaker B';
	lrsetSpeakerBTts.value = 'female';
	lrsetPubToggle.checked = false;
	lrsetErr.classList.add('hidden');
	lrsetDialogue = [{ speaker:'A', text:'' }, { speaker:'B', text:'' }];
	lrsetQuestions = [
		{ prompt:'', options:['', '', '', ''], correctIndex:0 },
		{ prompt:'', options:['', '', '', ''], correctIndex:0 },
		{ prompt:'', options:['', '', '', ''], correctIndex:0 },
	];
	renderDialogueLines();
	renderQuestions();
	updateLRChatPreview();
	lrsetModal.classList.remove('hidden');
});

document.getElementById('lrset-close-x').addEventListener('click', () => lrsetModal.classList.add('hidden'));
document.getElementById('lrset-cancel-btn').addEventListener('click', () => lrsetModal.classList.add('hidden'));
lrsetModal.addEventListener('click', (e) => { if (e.target === lrsetModal) lrsetModal.classList.add('hidden'); });
lrsetPubToggle.addEventListener('change', () => {
	document.getElementById('lrset-toggle-label').textContent = lrsetPubToggle.checked ? 'เผยแพร่ทันที' : 'บันทึกเป็นแบบร่าง';
});
document.getElementById('lrset-add-line-btn').addEventListener('click', () => {
	lrsetDialogue.push({ speaker:'A', text:'' });
	renderDialogueLines();
	updateLRChatPreview();
});

[lrsetSpeakerAName, lrsetSpeakerBName, lrsetSpeakerATts, lrsetSpeakerBTts].forEach((el) => {
	el.addEventListener('input', updateLRChatPreview);
});

function renderDialogueLines() {
	lrsetDialogueList.innerHTML = '';
	lrsetDialogueCount.textContent = String(lrsetDialogue.length);
	lrsetDialogue.forEach((line, idx) => {
		const card = document.createElement('div');
		card.className = 'manual-item-card';
		card.innerHTML = '<div class="mi-header"><span class="mi-num">' + (idx + 1) + '</span><button type="button" class="mi-delete-btn" data-idx="' + idx + '" title="ลบ"><ion-icon name="trash-outline"></ion-icon></button></div><div class="form-row"><div class="form-field" style="max-width:120px;"><label>ผู้พูด</label><select data-field="speaker"><option value="A"' + (line.speaker==='A'?' selected':'') + '>A (ซ้าย)</option><option value="B"' + (line.speaker==='B'?' selected':'') + '>B (ขวา)</option></select></div><div class="form-field"><label>ข้อความ <span style="color:red">*</span></label><input type="text" data-field="text" value="' + line.text + '" placeholder="พิมพ์บทสนทนา..." /></div></div>';
		lrsetDialogueList.appendChild(card);
	});
}

lrsetDialogueList.addEventListener('input', (e) => {
	const card = e.target.closest('.manual-item-card');
	if (!card) return;
	const idx = Array.from(lrsetDialogueList.children).indexOf(card);
	if (idx < 0) return;
	const field = e.target.dataset.field;
	if (field && lrsetDialogue[idx]) {
		lrsetDialogue[idx][field] = e.target.value;
		updateLRChatPreview();
	}
});

lrsetDialogueList.addEventListener('click', (e) => {
	const delBtn = e.target.closest('.mi-delete-btn');
	if (!delBtn) return;
	lrsetDialogue.splice(parseInt(delBtn.dataset.idx), 1);
	renderDialogueLines();
	updateLRChatPreview();
});

function renderQuestions() {
	lrsetQuestionList.innerHTML = '';
	lrsetQuestions.forEach((q, idx) => {
		const card = document.createElement('div');
		card.className = 'manual-item-card';
		card.innerHTML = '<div class="mi-header"><span class="mi-num">Q' + (idx + 1) + '</span></div><div class="form-field"><label>คำถาม <span style="color:red">*</span></label><input type="text" data-field="prompt" value="' + q.prompt + '" placeholder="เช่น พวกเขากำลังพูดถึงอะไร?" /></div><div class="form-row"><div class="form-field"><label>ตัวเลือก 1</label><input type="text" data-field="opt0" value="' + (q.options[0] || '') + '" /></div><div class="form-field"><label>ตัวเลือก 2</label><input type="text" data-field="opt1" value="' + (q.options[1] || '') + '" /></div></div><div class="form-row"><div class="form-field"><label>ตัวเลือก 3</label><input type="text" data-field="opt2" value="' + (q.options[2] || '') + '" /></div><div class="form-field"><label>ตัวเลือก 4</label><input type="text" data-field="opt3" value="' + (q.options[3] || '') + '" /></div></div><div class="form-field" style="max-width:160px;"><label>คำตอบที่ถูก (ลำดับ)</label><select data-field="correctIndex"><option value="0"' + (q.correctIndex===0?' selected':'') + '>ตัวเลือก 1</option><option value="1"' + (q.correctIndex===1?' selected':'') + '>ตัวเลือก 2</option><option value="2"' + (q.correctIndex===2?' selected':'') + '>ตัวเลือก 3</option><option value="3"' + (q.correctIndex===3?' selected':'') + '>ตัวเลือก 4</option></select></div>';
		lrsetQuestionList.appendChild(card);
	});
}

lrsetQuestionList.addEventListener('input', (e) => {
	const card = e.target.closest('.manual-item-card');
	if (!card) return;
	const idx = Array.from(lrsetQuestionList.children).indexOf(card);
	if (idx < 0) return;
	const field = e.target.dataset.field;
	if (!lrsetQuestions[idx]) return;
	if (field === 'prompt') lrsetQuestions[idx].prompt = e.target.value;
	else if (field === 'correctIndex') lrsetQuestions[idx].correctIndex = parseInt(e.target.value) || 0;
	else if (field && field.startsWith('opt')) {
		lrsetQuestions[idx].options[parseInt(field.charAt(3))] = e.target.value;
	}
});

function updateLRChatPreview() {
	const nameA = lrsetSpeakerAName.value || 'Speaker A';
	const nameB = lrsetSpeakerBName.value || 'Speaker B';
	const ttsA = lrsetSpeakerATts.value === 'male' ? 'ชาย' : 'หญิง';
	const ttsB = lrsetSpeakerBTts.value === 'male' ? 'ชาย' : 'หญิง';
	let html = '';
	lrsetDialogue.forEach((line) => {
		if (!line.text) return;
		const isA = line.speaker === 'A';
		const name = isA ? nameA : nameB;
		const tts = isA ? ttsA : ttsB;
		const side = isA ? 'left' : 'right';
		html += '<div class="chat-bubble ' + side + '"><div class="chat-speaker"><span class="chat-avatar ' + side + '">' + (isA ? 'A' : 'B') + '</span><span class="chat-name">' + name + '</span><span class="voice-badge ' + (isA ? lrsetSpeakerATts.value : lrsetSpeakerBTts.value) + '">🔊 ' + tts + '</span></div><div class="chat-text">' + line.text + '</div></div>';
	});
	if (!html) html = '<p class="text-muted" style="text-align:center;padding:20px;">เพิ่มบทสนทนาเพื่อดูพรีวิว</p>';
	lrsetChatPreview.innerHTML = html;
}

document.getElementById('lrset-save-btn').addEventListener('click', async () => {
	lrsetErr.classList.add('hidden');
	const title = lrsetTitle.value.trim();
	if (!title) { showLRSetError('กรุณากรอกชื่อชุด'); return; }
	const cleanDialogue = lrsetDialogue.filter((d) => d.text.trim());
	if (cleanDialogue.length === 0) { showLRSetError('กรุณาเพิ่มบทสนทนาอย่างน้อย 1 บรรทัด'); return; }
	if (lrsetQuestions.length !== 3) { showLRSetError('ต้องมีคำถามความเข้าใจ 3 ข้อเท่านั้น'); return; }
	for (let i = 0; i < lrsetQuestions.length; i++) {
		const q = lrsetQuestions[i];
		if (!q.prompt.trim() || q.options.filter(Boolean).length < 2) { showLRSetError('คำถาม ' + (i + 1) + ': ต้องกรอกคำถามและตัวเลือกอย่างน้อย 2 ตัวเลือก'); return; }
	}
	const payload = {
		title, level: lrsetLevel.value, description: lrsetDesc.value.trim(),
		speakerA: { name: (lrsetSpeakerAName.value || 'Speaker A').trim(), ttsVoice: lrsetSpeakerATts.value },
		speakerB: { name: (lrsetSpeakerBName.value || 'Speaker B').trim(), ttsVoice: lrsetSpeakerBTts.value },
		dialogue: cleanDialogue,
		status: lrsetPubToggle.checked ? 'published' : 'draft',
		questions: lrsetQuestions.map(q => ({ prompt: q.prompt, options: q.options.filter(Boolean), correctIndex: q.correctIndex })),
	};
	try {
		const token = await auth.currentUser.getIdToken();
		const url = lrsetEditId ? '/api/admin/listening-reading-sets/' + lrsetEditId : '/api/admin/listening-reading-sets';
		const res = await fetch(url, { method: lrsetEditId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(payload) });
		const data = await res.json();
		if (!data.success) throw new Error(data.error);
		lrsetModal.classList.add('hidden');
		await loadLRSets();
	} catch (err) { showLRSetError('บันทึกล้มเหลว: ' + err.message); }
});

function showLRSetError(msg) { lrsetErr.textContent = msg; lrsetErr.classList.remove('hidden'); }

async function loadLRSets() {
	const loading = document.getElementById('lrset-loading');
	const table = document.getElementById('lrset-table');
	const tbody = document.getElementById('lrset-tbody');
	loading.classList.remove('hidden'); table.classList.add('hidden');
	try {
		const token = await auth.currentUser.getIdToken();
		const res = await fetch('/api/admin/listening-reading-sets', { headers: { Authorization: 'Bearer ' + token } });
		const data = await res.json();
		if (!data.success) throw new Error(data.error);
		tbody.innerHTML = '';
		let i = 1;
		data.data.forEach((d) => {
			const speakers = d.speakerA && d.speakerB ? (d.speakerA.name||'A') + ' / ' + (d.speakerB.name||'B') : '—';
			const tr = document.createElement('tr');
			tr.innerHTML = '<td>' + (i++) + '</td><td><strong>' + d.title + '</strong></td><td>' + (d.level || '—') + '</td><td>' + speakers + '</td><td>' + (d.dialogue ? d.dialogue.length : 0) + '</td><td><span class="status-badge ' + d.status + ' status-toggle" data-id="' + d.id + '" data-status="' + d.status + '">' + (d.status === 'published' ? 'เผยแพร่' : 'ร่าง') + '</span></td><td><button class="btn-edit lrset-edit-btn" data-id="' + d.id + '">✏️</button><button class="btn-delete lrset-del-btn" data-id="' + d.id + '">🗑</button></td>';
			tbody.appendChild(tr);
		});
		loading.classList.add('hidden'); table.classList.remove('hidden');
	} catch (err) { loading.textContent = 'โหลดล้มเหลว: ' + err.message + err.message; }
}

document.getElementById('lrset-tbody').addEventListener('click', async (e) => {
	const editBtn = e.target.closest('.lrset-edit-btn');
	const delBtn = e.target.closest('.lrset-del-btn');
	if (delBtn) {
		if (!confirm('ลบชุดสนทนานี้?')) return;
		try { const token = await auth.currentUser.getIdToken(); await fetch('/api/admin/listening-reading-sets/' + delBtn.dataset.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); await loadLRSets(); }
		catch (err) { alert('ลบล้มเหลว: ' + err.message); }
	}
	if (editBtn) {
		try {
			const token = await auth.currentUser.getIdToken();
			const res = await fetch('/api/admin/listening-reading-sets', { headers: { Authorization: 'Bearer ' + token } });
			const data = await res.json();
			const set = data.data.find((s) => s.id === editBtn.dataset.id);
			if (!set) return;
			lrsetEditId = set.id;
			lrsetTitle.value = set.title || '';
			lrsetLevel.value = set.level || 'A1';
			lrsetDesc.value = set.description || '';
			lrsetSpeakerAName.value = set.speakerA?.name || 'Speaker A';
			lrsetSpeakerATts.value = set.speakerA?.ttsVoice || 'male';
			lrsetSpeakerBName.value = set.speakerB?.name || 'Speaker B';
			lrsetSpeakerBTts.value = set.speakerB?.ttsVoice || 'female';
			lrsetPubToggle.checked = set.status === 'published';
			lrsetDialogue = (set.dialogue || []).map(d => ({ ...d }));
			if (lrsetDialogue.length === 0) lrsetDialogue = [{ speaker:'A', text:'' }, { speaker:'B', text:'' }];
			lrsetQuestions = (set.questions || []).map(q => ({
				prompt: q.prompt || '',
				options: Array.isArray(q.options) ? q.options.concat(['','','','']).slice(0,4) : ['','','',''],
				correctIndex: q.correctIndex || 0,
			}));
			while (lrsetQuestions.length < 3) lrsetQuestions.push({ prompt:'', options:['','', '',''], correctIndex:0 });
			renderDialogueLines();
			renderQuestions();
			updateLRChatPreview();
			lrsetModal.classList.remove('hidden');
		} catch (err) { alert('โหลดข้อมูลล้มเหลว: ' + err.message); }
	}
});

// ══════════════════════════════════════════════════════════════════════════
// Status badge toggle — คลิกสถานะ (เผยแพร่/ร่าง) เพื่อเปลี่ยนผ่าน API
// ══════════════════════════════════════════════════════════════════════════
document.addEventListener('click', async (e) => {
	const badge = e.target.closest('.status-toggle');
	if (!badge) return;
	const id = badge.dataset.id;
	const current = badge.dataset.status;
	if (!id || !current) return;
	const next = current === 'published' ? 'draft' : 'published';
	const nextThai = next === 'published' ? 'เผยแพร่' : 'ร่าง';
	if (!confirm('ยืนยันการเปลี่ยนสถานะเป็น "' + nextThai + '" หรือไม่?')) return;
	try {
		const token = await auth.currentUser.getIdToken();
		const res = await fetch('/api/admin/exercises/' + id + '/status', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
			body: JSON.stringify({ status: next })
		});
		const data = await res.json();
		if (!data.success) throw new Error(data.error || 'FAILED');
		badge.dataset.status = next;
		badge.classList.remove('published', 'draft');
		badge.classList.add(next);
		badge.textContent = nextThai;
	} catch (err) {
		alert('เปลี่ยนสถานะไม่สำเร็จ: ' + err.message);
	}
});
