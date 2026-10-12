// public/admin/js/adminApp.js

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged }
	                                     from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, addDoc, serverTimestamp, query, where, limit, orderBy, getCountFromServer }
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

// ── Quota helpers ─────────────────────────────────────────────────────────
// ดัก error ประเภทโควต้า Firebase เต็ม (resource-exhausted / HTTP 429)
function isQuotaError(err) {
	if (!err) return false;
	const code = String(err.code || '');
	const msg = String(err.message || '').toLowerCase();
	return code === 'resource-exhausted' || code === 'too-many-requests'
		|| msg.includes('resource-exhausted') || msg.includes('429') || msg.includes('quota');
}
function quotaLoadMessage(err) {
	return isQuotaError(err)
		? 'โหลดข้อมูลไม่สำเร็จ: โควต้า Firebase เต็ม (ชั่วคราว) — กรุณาลองใหม่ในอีกสักครู่'
		: 'Load failed: ' + (err?.message || 'unknown error');
}
// เพดานอ่านต่อ query — กัน collection ที่โตไม่รู้จบ (statistics) กินโควต้า
const MAX_ADMIN_ROWS = 5000;

// catch Firestore Rules rejection (permission-denied / insufficient permissions)
function isPermissionError(err) {
	if (!err) return false;
	const code = String(err.code || '');
	const msg = String(err.message || '').toLowerCase();
	return code === 'permission-denied'
		|| msg.includes('permission') || msg.includes('insufficient permissions');
}


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
const inpUsername   = document.getElementById('inp-username');
const inpPassword   = document.getElementById('inp-password');
const topbarUser    = document.getElementById('topbar-user');

// ── Admin session token (username/password login — เก็บใน sessionStorage) ─────
// ทุก request ไป /api/admin/* ใช้ token นี้แทน Firebase ID token (จุดเดิม 17 จุด)
// ใช้ sessionStorage เท่านั้น: ปิดแท็บ/เปิดแท็บใหม่ = ต้อง login ใหม่ (แก้ค้างหน้า /admin)
const getAdminToken = () => {
	try { return sessionStorage.getItem('adminToken') || ''; } catch (_) { return ''; }
};
const getAdminUsername = () => {
	try { return sessionStorage.getItem('adminUsername') || ''; } catch (_) { return ''; }
};
function getAuthHeaders() {
	const token = getAdminToken();
	if (!token) throw new Error('Not logged in');
	return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
}
function setAdminSessionStorage(token, username) {
	try {
		sessionStorage.setItem('adminToken', token);
		sessionStorage.setItem('adminUsername', username);
		// ล้างค่าเก่าที่เคยค้างใน localStorage (กันแท็บใหม่ restore จากของเก่า)
		localStorage.removeItem('adminToken');
		localStorage.removeItem('adminUsername');
	} catch (_) { /* ignore */ }
}
function clearAdminSessionStorage() {
	try {
		sessionStorage.removeItem('adminToken');
		sessionStorage.removeItem('adminUsername');
		// ล้างของเก่าเผื่อเคยค้างก่อนย้ายมา sessionStorage
		localStorage.removeItem('adminToken');
		localStorage.removeItem('adminUsername');
	} catch (_) { /* ignore */ }
}

// ── Unsaved Changes Guard (Dirty form tracking + Confirmation dialog) ──────
// isFormDirty = true เมื่อผู้ใช้พิมพ์/เปลี่ยนค่าใน input/select/textarea ของฟอร์มเพิ่ม-แก้ไข
// (ทั้งรูปแบบ Modal และ Full-page Editor) — รีเซ็ตเมื่อเปิดฟอร์มใหม่, บันทึกสำเร็จ,
// หรือยืนยัน "ออกจากหน้านี้โดยไม่บันทึก" แล้ว
let isFormDirty = false;
function markFormDirty() { isFormDirty = true; }
function resetFormDirty() { isFormDirty = false; }

// จับ input/change แบบ capture ทั้งเอกสาร — ครอบ element ที่ inject ทีหลังด้วย
// (คู่คำศัพท์/โจทย์/แถบ toggle ต่างๆ ที่อยู่ใน .modal-card หรือ .vocabset-edit-form)
const FORM_SCOPE = '.modal-card, .vocabset-edit-form';
document.addEventListener('input', (e) => { if (e.target.closest(FORM_SCOPE)) markFormDirty(); }, true);
document.addEventListener('change', (e) => { if (e.target.closest(FORM_SCOPE)) markFormDirty(); }, true);

// ── Confirmation dialog (Promise-based, ธีมเดียวกับ modal ของแอดมิน) ──
const confirmModal   = document.getElementById('confirm-modal');
const confirmTitleEl = document.getElementById('confirm-title');
const confirmMsgEl   = document.getElementById('confirm-message');
const confirmKeepBtn = document.getElementById('confirm-keep-btn');
const confirmLeaveBtn = document.getElementById('confirm-leave-btn');
let confirmResolver = null;

function resolveConfirmDialog(value) {
	if (!confirmResolver) return;
	const resolve = confirmResolver;
	confirmResolver = null;
	confirmModal?.classList.add('hidden');
	resolve(value);
}

// คืน Promise<boolean>: true = ยืนยันออกโดยไม่บันทึก, false = อยู่ต่อ
function showConfirmDialog({ title, message, cancelText = 'ทำต่อ', confirmText = 'ออกจากหน้านี้โดยไม่บันทึก' } = {}) {
	if (!confirmModal) return Promise.resolve(true);           // ไม่มี dialog → fail-open
	if (confirmResolver) return Promise.resolve(false);        // เปิดอยู่แล้ว → กันซ้ำ
	if (confirmTitleEl) confirmTitleEl.textContent = title || 'คุณมีข้อมูลที่ยังไม่ได้บันทึก';
	if (confirmMsgEl) confirmMsgEl.textContent = message || 'หากออกจากหน้านี้ ข้อมูลที่คุณแก้ไขไว้จะไม่ถูกบันทึก คุณต้องการออกจากหน้านี้ใช่หรือไม่?';
	if (confirmKeepBtn) confirmKeepBtn.textContent = cancelText;
	if (confirmLeaveBtn) confirmLeaveBtn.textContent = confirmText;
	confirmModal.classList.remove('hidden');
	return new Promise((resolve) => { confirmResolver = resolve; });
}

confirmKeepBtn?.addEventListener('click', () => resolveConfirmDialog(false));
confirmLeaveBtn?.addEventListener('click', () => resolveConfirmDialog(true));
// คลิกพื้นหลัง/กด Esc = ทำต่อ (อยู่หน้าฟอร์มเดิม)
confirmModal?.addEventListener('click', (e) => { if (e.target === confirmModal) resolveConfirmDialog(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && confirmResolver) resolveConfirmDialog(false); });

// dirty → เด้ง dialog; ยืนยันออก → reset dirty แล้วคืน true; ไม่ dirty → ผ่านทันที
async function confirmDiscardIfDirty() {
	if (!isFormDirty) return true;
	const leave = await showConfirmDialog({});
	if (leave) resetFormDirty();
	return leave;
}

// ครอบ close function เดิม: ไม่ dirty → ปิดทันที, dirty → ถามก่อนค่อยปิด
function guardedClose(closeFn) {
	confirmDiscardIfDirty().then((ok) => { if (ok) closeFn(); });
}

// คุ้มกัน modal ที่ยังไม่มี handler ปิดในโค้ดเดิม (แก้ไขสมาชิก / Generator)
['edit-cancel-btn', 'gen-cancel-btn', 'gen-close-x'].forEach((id) => {
	const btn = document.getElementById(id);
	btn?.addEventListener('click', () => {
		const overlay = btn.closest('.modal-overlay');
		guardedClose(() => { overlay?.classList.add('hidden'); resetFormDirty(); });
	});
});
['edit-user-modal', 'generator-modal'].forEach((id) => {
	const ov = document.getElementById(id);
	ov?.addEventListener('click', (e) => {
		if (e.target !== ov) return;
		guardedClose(() => { ov.classList.add('hidden'); resetFormDirty(); });
	});
});

// beforeunload — Full-page Editor (ชุดคำศัพท์/Tense/การฟังและการดู) เท่านั้น
// ใช้ข้อความ default ของเบราว์เซอร์ (Chrome ไม่อนุญาตข้อความ custom)
window.addEventListener('beforeunload', (e) => {
	if (!isFormDirty) return;
	const editOpen = ['section-vocabset-edit', 'section-tenseset-edit', 'section-lrset-edit']
		.some((id) => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); });
	if (!editOpen) return;
	e.preventDefault();
	e.returnValue = '';
});

// ── Auth state watcher ─────────────────────────────────────────────────────

// true ระหว่างรอ Firebase Auth init ครั้งแรก — ห้ามแตะ UI (showLogin/showDashboard)
// จนกว่าจะยืนยันผลตัวตนเสร็จ ป้องกัน UI วาบไปหน้า login ชั่วคราว
let isAuthChecking = true;
// true เมื่อผ่านการ login + ตรวจสิทธิ์ admins/{email} แล้วใน session นี้
let isAdminSession = false;

// ── View visibility (ตัวเดียวคุม 3 view แบบ mutually exclusive — กันจอขาว) ──
// 'loading'    → โชว์ #auth-loading, ซ่อน #login-view + #dashboard-view
// 'login'      → โชว์ #login-view, ซ่อนอีกสอง
// 'dashboard'  → โชว์ #dashboard-view, ซ่อนอีกสอง
function setVisibleView(which) {
	try {
		const loading = document.getElementById('auth-loading');
		const login   = document.getElementById('login-view') || document.getElementById('login-container');
		const dash    = document.getElementById('dashboard-view') || document.getElementById('admin-view') || document.getElementById('app-container');
		if (loading) loading.classList.toggle('hidden', which !== 'loading');
		if (login) login.classList.toggle('hidden', which !== 'login');
		if (dash) dash.classList.toggle('hidden', which !== 'dashboard');
	} catch (err) {
		console.error('[view] setVisibleView failed:', err.message);
	}
}

function hideAuthLoading() {
	try {
		document.getElementById('auth-loading')?.classList.add('hidden');
	} catch (_) { /* ignore */ }
}

// Only auto-redirect if we already verified admin in this session
onAuthStateChanged(auth, (user) => {
	try {
		isAuthChecking = false;
		const savedToken    = getAdminToken();
		const savedUsername = getAdminUsername();

		// ไม่มี session token ใน sessionStorage (แท็บใหม่/ปิดแท็บแล้ว) → ถือว่าออกจากระบบแล้ว
		// (Firebase session ค้างอยู่คนเดียวไม่พอ — token คือ source of truth)
		if (!savedToken) {
			isAdminSession = false;
			if (user) signOut(auth).catch(() => {});
			showLogin();
			return;
		}

		// login ผ่านแล้วใน session นี้ → กลับเข้าหน้าเดิมเลย
		if (isAdminSession) {
			showDashboard(savedUsername || user?.email || '');
			return;
		}

		// restore หลังรีเฟรชหน้าในแท็บเดิม (มี token ใน sessionStorage เท่านั้น):
		// - Firebase session ยังอยู่ → เข้า dashboard เลย
		// - session หาย (IndexedDB ถูกล้าง) → ขอ customToken ใหม่ผ่าน
		//   POST /api/admin/session แล้ว signIn เงียบๆ (fail-soft ทุกขั้นตอน)
		(async () => {
			try {
				if (!auth.currentUser) {
					try {
						const res = await fetch('/api/admin/session', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + savedToken },
						});
						if (res.status === 401 || res.status === 403) {
							// session token หมดอายุ/ไม่ถูกต้อง → ล้างแล้วกลับหน้า login
							clearAdminSessionStorage();
							isAdminSession = false;
							showLogin();
							return;
						}
						const data = await res.json().catch(() => ({}));
						if (data.customToken) await signInWithCustomToken(auth, data.customToken);
					} catch (refreshErr) {
						console.warn('[auth] silent customToken refresh failed (fail-soft):', refreshErr.message);
					}
				}
				isAdminSession = true;
				showDashboard(savedUsername || user?.email || '');
			} catch (err) {
				console.error('[auth] restore session failed:', err.message);
				isAdminSession = false;
				showLogin();
			}
		})();
	} catch (err) {
		console.error('[auth] watcher failed:', err.message);
		try { showLogin(); } catch (_) { /* ignore */ }
	}
});

// หัวข้อแต่ละหน้า (ใช้กับ topbar #section-title เมื่อสลับหน้า + ตรวจ section ที่จำไว้หลังรีเฟรช)
const SECTION_TITLES = {
	overview: 'ภาพรวมระบบ',
	vocabulary: 'แบบฝึกหัดคำศัพท์',
	tense: 'แบบฝึก Tense',
	'listening-reading': 'การฟังและการดู Tense',
	'vocab-library': 'คลังคำศัพท์',
	stats: 'สถิติการใช้งาน',
	users: 'รายชื่อสมาชิก',
	exercises: 'แบบฝึกหัดทั้งหมด',
	admins: 'ผู้ดูแลระบบ (Admin)',
};

// ── Show / hide views ──────────────────────────────────────────────────────

function showLogin() {
	try {
		// ระหว่างรอ Firebase init ห้ามสลับ UI — กันวาบไปหน้า login ชั่วคราว
		if (isAuthChecking) return;
		setVisibleView('login');
	} catch (err) {
		console.error('[view] showLogin failed:', err.message);
	}
}

function showDashboard(email) {
	try {
		setVisibleView('dashboard');
		if (topbarUser) topbarUser.textContent = email || '';
		// ลำดับสำรองหน้าแรก: hash (#/stats) → sessionStorage → overview
		const fromHash = parseSectionHash();
		let saved = null;
		try { saved = sessionStorage.getItem('adminActiveSection'); } catch (_) { /* ignore */ }
		const initial = (fromHash && SECTION_TITLES[fromHash]) ? fromHash
			: (saved && SECTION_TITLES[saved]) ? saved : 'overview';
		navigateToSection(initial);
	} catch (err) {
		console.error('[view] showDashboard failed:', err.message);
		try { setVisibleView('login'); } catch (_) { /* ignore */ }
	}
}

// ── Toggle password visibility ─────────────────────────────────────────────

togglePwBtn.addEventListener('click', () => {
	const isText = inpPassword.type === 'text';
	inpPassword.type   = isText ? 'password' : 'text';
	togglePwBtn.innerHTML = isText ? '<ion-icon name="eye-outline"></ion-icon>' : '<ion-icon name="eye-off-outline"></ion-icon>';
});

// ── Login form submit ──────────────────────────────────────────────────────

loginForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	setLoginLoading(true);
	loginError.classList.add('hidden');

	const username = inpUsername.value.trim();
	const password = inpPassword.value;

	try {
		// 1. เข้าสู่ระบบผ่าน Backend (username/password → session token)
		let res;
		try {
			res = await fetch('/api/admin/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password }),
			});
		} catch (netErr) {
			showError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
			return;
		}
		const data = await res.json().catch(() => ({}));

		if (res.status === 429) {
			showError(data.error || 'พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่');
			return;
		}
		if (res.status === 400) {
			showError(data.error || 'กรุณากรอกชื่อผู้ดูแลและรหัสผ่าน');
			return;
		}
		if (res.status === 401 || !data.success) {
			showError(data.error || 'ชื่อผู้ดูแลหรือรหัสผ่านไม่ถูกต้อง');
			return;
		}
		if (!data.token) {
			showError('เข้าสู่ระบบไม่สำเร็จ: เซิร์ฟเวอร์ไม่ส่ง session token กลับมา');
			return;
		}

		// 2. เก็บ session token + username ใน sessionStorage (ใช้ทุก request แทน Firebase ID token)
		setAdminSessionStorage(data.token, data.username || username);

		// 3. Firebase session ประกอบ (fail-soft — ล้มเหลวก็ยังเรียก API ได้ด้วย session token)
		if (data.customToken) {
			try {
				await signInWithCustomToken(auth, data.customToken);
			} catch (fbErr) {
				console.warn('[login] signInWithCustomToken failed (fail-soft):', fbErr.message);
			}
		} else {
			console.warn('[login] no customToken returned (fail-soft)');
		}

		// 4. ผ่านหมด → เปิด dashboard
		isAdminSession = true;
		showDashboard(data.username || username);
	} catch (err) {
		clearAdminSessionStorage();
		await signOut(auth).catch(() => {});
		isAdminSession = false;
		showError('เข้าสู่ระบบไม่สำเร็จ: ' + (err.message || 'unknown error'));
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
	// ยืนยันก่อนออก — ถ้ามีข้อมูลค้างอยู่ในฟอร์ม แจ้งเตือนเพิ่มว่าจะสูญหาย
	const ok = await showConfirmDialog({
		title: 'ยืนยันการออกจากระบบ',
		message: isFormDirty
			? 'คุณมีข้อมูลที่ยังไม่ได้บันทึก หากออกจากระบบตอนนี้ ข้อมูลที่แก้ไขไว้จะสูญหาย ต้องการออกจากระบบใช่หรือไม่?'
			: 'คุณต้องการออกจากระบบจากหน้าผู้ดูแลระบบใช่หรือไม่?',
		cancelText: 'อยู่ต่อ',
		confirmText: 'ออกจากระบบ',
	});
	if (!ok) return;
	try {
		await signOut(auth);
		clearAdminSessionStorage();
		isAdminSession = false;
		try { sessionStorage.removeItem('adminActiveSection'); } catch (_) { /* ignore */ }
		if (window.location.hash) history.replaceState(null, '', window.location.pathname);
		resetFormDirty();
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
	try {
		// กันจำค่าขยะ: section ต้องมีจริงเท่านั้น (เช่น คลิก element ที่ไม่มี data-section)
		if (!section || !SECTION_TITLES[section]) section = 'overview';
		try { sessionStorage.setItem('adminActiveSection', section); } catch (_) { /* ignore */ }
		document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
		const navItem = document.querySelector('.nav-item[data-section="' + section + '"]');
		if (navItem) navItem.classList.add('active');
		document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
		// section ปลายทางหาย → fallback overview กันจอว่าง
		let target = document.getElementById('section-' + section);
		if (!target) {
			target = document.getElementById('section-overview');
			if (target) target.classList.remove('hidden');
		} else {
			target.classList.remove('hidden');
		}
	// อัปเดตหัวข้อหน้าให้ตรงกับหน้าที่เลือก (ก่อนหน้านี้ค้างเป็น "ภาพรวมระบบ" ตลอด)
	const titleEl = document.getElementById('section-title');
	if (titleEl && SECTION_TITLES[section]) titleEl.textContent = SECTION_TITLES[section];
	setTopbarBackVisible(false); // สลับ section ใดๆ ผ่าน sidebar → ซ่อนปุ่ม ← กลับ บน topbar เสมอ
	if (section === 'overview') loadStats();
	if (section === 'vocabulary') loadVocabSets();
	if (section === 'tense') loadTenseSets();
	if (section === 'listening-reading') loadLRSets();
	if (section === 'vocab-library') loadVocab();
	if (section === 'stats') loadExerciseStats();
	if (section === 'users') loadUsers();
	if (section === 'exercises') loadExercises();
	if (section === 'admins') loadAdmins();
	// sync hash แบบ replace (ไม่ดัน history) — รีเฟรช/Back-Forward กลับมาหน้านี้ได้
	try {
		const want = '#/' + section;
		if (window.location.hash !== want) history.replaceState(null, '', want);
	} catch (_) { /* ignore */ }
	try { window.scrollTo(0, 0); } catch (_) { /* ignore */ }
	} catch (err) {
		console.error('[nav] navigateToSection failed:', err.message);
		try {
			document.getElementById('section-overview')?.classList.remove('hidden');
		} catch (_) { /* ignore */ }
	}
}

// อ่าน section จาก hash (#/stats) — คืน '' ถ้าไม่มีหรือไม่รู้จัก
function parseSectionHash() {
	try {
		const h = (window.location.hash || '').replace(/^#\/?/, '');
		return h || '';
	} catch (_) { return ''; }
}

// Back/Forward → เปลี่ยน section ตาม hash (ผ่าน dirty-guard เดิม)
window.addEventListener('hashchange', () => {
	try {
		// ยังอยู่หน้า login / กำลังเช็ก auth → ไม่ต้องทำอะไร
		if (isAuthChecking) return;
		const dv = document.getElementById('dashboard-view') || document.getElementById('admin-view') || document.getElementById('app-container');
		if (!dv || dv.classList.contains('hidden')) return;
		const section = parseSectionHash();
		if (section && SECTION_TITLES[section]) attemptNavigate(section);
	} catch (err) {
		console.error('[nav] hashchange failed:', err.message);
	}
});

// ── ปุ่ม ← กลับ บน topbar (แสดงเฉพาะโหมดเพิ่ม/แก้ไขของหน้า full-page editor) ──
const topbarBackBtn = document.getElementById('topbar-back-btn');
function setTopbarBackVisible(on) {
	if (topbarBackBtn) topbarBackBtn.classList.toggle('hidden', !on);
}

// กด ← กลับ บน topbar → ยกเลิกโหมดเพิ่ม/แก้ไข แล้วกลับหน้ารายการหลักของระบบนั้น
// (มีข้อมูลค้างอยู่ → เด้ง Confirmation dialog ก่อน)
topbarBackBtn?.addEventListener('click', () => {
	const vEdit = document.getElementById('section-vocabset-edit');
	const tEdit = document.getElementById('section-tenseset-edit');
	const lEdit = document.getElementById('section-lrset-edit');
	if (vEdit && !vEdit.classList.contains('hidden')) { guardedClose(hideVocabSetEdit); return; }
	if (tEdit && !tEdit.classList.contains('hidden')) { guardedClose(closeTenseSetModal); return; }
	if (lEdit && !lEdit.classList.contains('hidden')) { guardedClose(closeLRSetPage); return; }
	setTopbarBackVisible(false);
});

// สลับหน้าผ่าน Sidebar/Dashboard — คุ้มกันฟอร์มที่มีข้อมูลค้างอยู่ก่อนสลับ
async function attemptNavigate(section) {
	if (!(await confirmDiscardIfDirty())) return; // ยังไม่ยืนยัน → อยู่หน้าเดิม
	// ยืนยันออกแล้ว → ปิด overlay ค้างที่เปิดอยู่ด้วย (กัน modalลอยไปหน้าใหม่)
	document.querySelectorAll('.modal-overlay').forEach((m) => {
		if (m.id !== 'confirm-modal') m.classList.add('hidden');
	});
	navigateToSection(section);
}

// คลิกการ์ดสรุปบน Dashboard → สลับไปหน้าเต็มของรายการนั้น
function openSectionFromCard(card) {
	const section = card && card.dataset ? card.dataset.section : '';
	if (!section) return;
	attemptNavigate(section);
}

document.querySelectorAll('.stat-card.clickable').forEach(card => {
	card.addEventListener('click', () => openSectionFromCard(card));
	// รองรับคีย์บอร์ด (Enter / Space) สำหรับการ์ดที่เป็น role="button"
	card.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openSectionFromCard(card);
		}
	});
});

document.querySelectorAll('.nav-item').forEach(item => {
	item.addEventListener('click', (e) => {
		// Let the logout link handle its own action
		if (item.classList.contains('nav-logout')) return;
		e.preventDefault();
		attemptNavigate(item.dataset.section);
	});
});

// Quick-menu on Dashboard (mirrors sidebar navigation)
document.querySelectorAll('.quick-menu-item').forEach(item => {
	item.addEventListener('click', (e) => {
		e.preventDefault();
		attemptNavigate(item.dataset.section);
	});
});

// ── Overview stats ─────────────────────────────────────────────────────────

async function loadStats() {
	// Members come from Firebase Auth (source of truth) via the backend
	// Admin API — counting Firestore 'users' docs shows 0 for auth-only members.
	const statUsers = document.getElementById('stat-users');
	const apiRes = await (async () => {
		try {
			const token = getAdminToken();
			const res = await fetch('/api/admin/users', { headers: { Authorization: 'Bearer ' + token } });
			const data = await res.json();
			if (data.success && typeof data.count === 'number') return data.count;
			throw new Error(data.error || 'Unexpected users API response');
		} catch (err) {
			console.error('[loadStats-users]', err.message);
			if (statUsers) statUsers.textContent = '—';
			return null;
		}
	})();
	// นับจำนวนแบบ server-side aggregation → ไม่ต้องดึงทั้ง collection มาโหลด (ลด read bandwidth มหาศาล)
	// ถ้า API นี้ไม่รองรับจะ fallback เป็นนับจาก docs ที่โหลด (มี limit แล้ว)
	const countCol = async (colName) => {
		try {
			return (await getCountFromServer(collection(db, colName))).data().count;
		} catch (err) {
			console.warn('[loadStats] getCountFromServer ล้มเหลว → fallback getDocs:', err.message);
			const snap = await getDocs(query(collection(db, colName), limit(MAX_ADMIN_ROWS)));
			return snap.size;
		}
	};
	const [exercises, vocab, admins] = await Promise.all([
		countCol('exercises'),
		countCol('vocabulary'),
		countCol('admins'),
	]);
	const statExercises = document.getElementById('stat-exercises');
	const statVocab     = document.getElementById('stat-vocab');
	const statAdmins    = document.getElementById('stat-admins');
	if (statUsers && apiRes != null) statUsers.textContent = String(apiRes);
	if (statExercises) statExercises.textContent = String(exercises);
	if (statVocab)     statVocab.textContent     = String(vocab);
	if (statAdmins)    statAdmins.textContent    = String(admins);
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
		allUserRows.sort((a, b) => (getCreatedAtSeconds(b.createdAt) ?? 0) - (getCreatedAtSeconds(a.createdAt) ?? 0));
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
		const token = getAdminToken();
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
		const snap = await getDocs(query(collection(db, 'users'), limit(MAX_ADMIN_ROWS)));
		const rows = snap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }));
		renderList(rows);
	} catch (err2) {
		console.error('[loadUsers] Fetch users failed:', err2.message, err2);
		loading.classList.add('hidden');
		loading.textContent = quotaLoadMessage(err2);
		table.classList.add('hidden');
		tbody.innerHTML = '<tr><td colspan="5" class="empty-row">โหลดข้อมูลไม่สำเร็จ — ตรวจ Firebase Rules / backend</td></tr>';
	}
}

function renderUsersPage(tbody, rows, page, perPage) {
	const start = (page - 1) * perPage;
	const slice = rows.slice(start, start + perPage);
	if (slice.length === 0) {
		tbody.innerHTML = '<tr><td colspan="3" class="empty-row">ไม่พบข้อมูลสมาชิก</td></tr>';
		return;
	}
	tbody.innerHTML = slice.map((u) => {
		return `
		<tr>
			<td>${escapeHtml(u.email) || '—'}</td>
			<td>${escapeHtml(u.name || u.displayName || u.username) || '—'}</td>
			<td>${formatThaiDate(u.createdAt)}</td>
		</tr>`;
	}).join('');
}

// escape HTML ป้องกัน XSS จากข้อมูล user (email/ชื่อ/uid) ก่อนใส่ innerHTML
function escapeHtml(s) {
	if (s == null) return '';
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

// ── Firestore Timestamp → seconds ────────────────────────────────────────────
// Admin API อาจส่ง createdAt ได้หลายรูป ({seconds} / {_seconds} / ISO / millis)
// — ดึงค่า seconds ออกมาให้ได้ทุกรูป แปลงไม่ได้คืน null (caller แสดง '—')
function getCreatedAtSeconds(v) {
	if (v == null) return null;
	if (typeof v.toDate === 'function') {
		try {
			const ms = v.toDate().getTime();
			if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
		} catch { return null; }
		return null;
	}
	if (typeof v === 'object') {
		const s = v.seconds ?? v._seconds;
		if (Number.isFinite(Number(s))) return Number(s);
		const ms = v.milliseconds ?? v._milliseconds;
		if (Number.isFinite(Number(ms))) return Math.floor(Number(ms) / 1000);
		return null;
	}
	if (typeof v === 'string') {
		const ms = Date.parse(v); // ISO 8601 เท่านั้น (ห้าม format ท้องถิ่น — Hermes/Android)
		return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
	}
	if (typeof v === 'number' && Number.isFinite(v)) {
		return v > 1e11 ? Math.floor(v / 1000) : Math.floor(v); // > 1e11 = millis
	}
	return null;
}

// — format วันที่ไทย แปลงไม่ได้คืน '—' (ห้ามปล่อย "Invalid Date" หลุด UI)
function formatThaiDate(v) {
	const s = getCreatedAtSeconds(v);
	if (s == null) return '—';
	const d = new Date(s * 1000);
	return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('th-TH');
}

// — format วัน+เวลาไทย (ตารางสถิติ) แปลงไม่ได้คืน '—'
function formatThaiDateTime(v) {
	const s = getCreatedAtSeconds(v);
	if (s == null) return '—';
	const d = new Date(s * 1000);
	return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('th-TH');
}

// หมายเหตุ: ปุ่ม "ลบ" ในตารางรายชื่อสมาชิกถูกนำออกแล้ว (ไม่อนุญาตให้ลบสมาชิกจากหน้านี้)

// ══════════════════════════════════════════════════════════════════════════
// Exercises CRUD (Generator + Manual + Item-level edit)
// ══════════════════════════════════════════════════════════════════════════

// ชื่อหมวด (ใช้ทั้งตารางและ alert — ห้ามใส่ HTML) + ไอคอนคู่กัน (ใช้เฉพาะเซลล์ตาราง)
const CAT_NAMES = { vocab: 'คำศัพท์', tense: 'Tense', listening: 'การฟังและการดู Tense' };
const CAT_ICONS  = { vocab: 'book-outline', tense: 'time-outline', listening: 'headset-outline' };

let allExerciseRows = [];
let exActiveCategory = 'all';
const EX_PAGE_SIZE = 10;

async function loadExercises() {
	const loading = document.getElementById('exercises-loading');
	const table   = document.getElementById('exercises-table');
	const tbody   = document.getElementById('exercises-tbody');
	const pagin   = document.getElementById('exercises-pagination');

	loading.classList.remove('hidden');
	table.classList.add('hidden');

	try {
		const snap = await getDocs(query(collection(db, 'exercises'), limit(MAX_ADMIN_ROWS)));
		allExerciseRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
		allExerciseRows.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));

		renderExercisesPage(tbody, pagin);
		loading.classList.add('hidden');
		table.classList.remove('hidden');
	} catch (err) {
		loading.textContent = quotaLoadMessage(err);
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
				<td><ion-icon name="${CAT_ICONS[d.category] || 'library-outline'}"></ion-icon> ${CAT_NAMES[d.category] || d.category || '—'}</td>
				<td>${d.description || '—'}</td>
				<td>${items.length}</td>
				<td style="white-space:nowrap">
					<button class="btn-action edit ex-edit-btn" data-id="${d.id}"><ion-icon name="create-outline"></ion-icon> Edit</button>
					<button class="btn-action delete ex-delete-btn" data-id="${d.id}" data-title="${d.title || ''}"><ion-icon name="trash-outline"></ion-icon> ลบ</button>
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
	resetFormDirty(); // เปิดฟอร์มใหม่ → เริ่มต้น isFormDirty = false
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

function closeExModal() { exModal.classList.add('hidden'); resetFormDirty(); }
exCancelBtn.addEventListener('click', () => guardedClose(closeExModal));
exCloseX.addEventListener('click', () => guardedClose(closeExModal));
exModal.addEventListener('click', (e) => { if (e.target === exModal) guardedClose(closeExModal); });

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
		// Normalize distractors เป็น array เสมอ — รองรับข้อมูลเก่าที่เป็น string คั่นคอมมา
		const distArr = Array.isArray(item.distractors)
			? item.distractors.map((d) => String(d ?? '').trim()).filter(Boolean)
			: String(item.distractors ?? '').split(',').map((s) => s.trim()).filter(Boolean);
		item.distractors = distArr;
		const distRows = distArr.map((d, di) => `
					<div class="mi-dist-row" data-uid="${uid}" data-di="${di}" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
						<input class="mi-dist-input" type="text" placeholder="พิมพ์เพื่อค้นหา เช่น ban… (bag — กระเป๋า)" value="${escHtml(d)}" data-uid="${uid}" data-di="${di}" autocomplete="off" style="flex:1;" />
						<button type="button" class="mi-dist-del" data-uid="${uid}" data-di="${di}" title="ลบคำตอบหลอกนี้" style="border:1px solid #f0caca;background:#fff5f5;color:#d63031;border-radius:8px;padding:6px 10px;cursor:pointer;">🗑</button>
						<div class="mi-dist-suggest hidden" data-uid="${uid}" data-di="${di}" style="position:absolute;"></div>
					</div>`).join('');
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
					<label>คำตอบหลอก (Distractors) — ว่าง = สุ่มอัตโนมัติตอนสอบ</label>
					<div class="mi-dist-list" data-uid="${uid}" style="position:relative;">${distRows || '<div class="text-muted" style="font-size:12px;padding:4px 0 8px;">— ไม่กำหนด (สุ่มอัตโนมัติ) —</div>'}</div>
					<button type="button" class="mi-dist-add" data-uid="${uid}" style="border:1px dashed #5B4FCF;background:#EEF0FF;color:#5B4FCF;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;">+ เพิ่มคำตอบหลอก</button>
					<div class="field-hint">สูงสุด 5 ช่อง — ห้ามซ้ำคำตอบถูกและห้ามซ้ำกันเอง</div>
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
	if (delBtn) {
		exManualItems = exManualItems.filter(it => it._uid !== delBtn.dataset.uid);
		renderManualItems();
		return;
	}
	// + เพิ่มคำตอบหลอก — สูงสุด 5 ช่องต่อข้อ
	const addDist = e.target.closest('.mi-dist-add');
	if (addDist) {
		const item = exManualItems.find(it => it._uid === addDist.dataset.uid);
		if (!item) return;
		if (!Array.isArray(item.distractors)) item.distractors = [];
		if (item.distractors.length >= 5) {
			alert('เพิ่มคำตอบหลอกได้สูงสุด 5 ช่องต่อข้อ');
			return;
		}
		item.distractors.push('');
		renderManualItems();
		// โฟกัสช่องใหม่ทันที
		const rows = exItemList.querySelectorAll(`.mi-dist-input[data-uid="${item._uid}"]`);
		rows[rows.length - 1]?.focus();
		return;
	}
	// 🗑 ลบช่องคำตอบหลอก
	const delDist = e.target.closest('.mi-dist-del');
	if (delDist) {
		const item = exManualItems.find(it => it._uid === delDist.dataset.uid);
		if (!item || !Array.isArray(item.distractors)) return;
		item.distractors.splice(parseInt(delDist.dataset.di, 10), 1);
		renderManualItems();
		return;
	}
	// เลือกคำจาก autocomplete
	const sugBtn = e.target.closest('.mi-dist-sug-item');
	if (sugBtn) {
		const item = exManualItems.find(it => it._uid === sugBtn.dataset.uid);
		if (!item) return;
		const di = parseInt(sugBtn.dataset.di, 10);
		const val = sugBtn.dataset.en || '';
		// กันซ้ำ: เท่าคำตอบถูก หรือซ้ำช่องอื่นในข้อเดียวกัน
		const correct = String(item.wordEN || '').trim().toLowerCase();
		const dupOther = (item.distractors || []).some((d, j) => j !== di && String(d || '').trim().toLowerCase() === val.toLowerCase());
		if (val.toLowerCase() === correct) {
			alert('คำตอบหลอกห้ามซ้ำกับคำตอบที่ถูกต้อง');
			return;
		}
		if (dupOther) {
			alert('คำนี้เลือกไปแล้วในข้อนี้');
			return;
		}
		item.distractors[di] = val;
		renderManualItems();
		return;
	}
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
	// พิมพ์ในช่องคำตอบหลอก → อัปเดต state + โชว์ autocomplete จากคลัง
	else if (inp.classList.contains('mi-dist-input')) {
		const di = parseInt(inp.dataset.di, 10);
		if (!Array.isArray(item.distractors)) item.distractors = [];
		item.distractors[di] = inp.value;
		renderMiDistSuggest(uid, di, inp.value);
	}
});

// Autocomplete คำตอบหลอกจากคลังคำศัพท์ — โชว์ EN + TH, พิมพ์กรองอัตโนมัติ
async function renderMiDistSuggest(uid, di, text) {
	const box = exItemList.querySelector(`.mi-dist-suggest[data-uid="${uid}"][data-di="${di}"]`);
	if (!box) return;
	const q = String(text ?? '').trim().toLowerCase();
	if (q.length < 1) { box.classList.add('hidden'); box.innerHTML = ''; return; }
	const cache = await ensureVocabSuggestCache();
	const item = exManualItems.find(it => it._uid === uid);
	const correct = String(item?.wordEN || '').trim().toLowerCase();
	const taken = new Set((item?.distractors || []).map((d, j) => j === di ? null : String(d || '').trim().toLowerCase()).filter(Boolean));
	const matches = cache
		.filter((v) => {
			const en = String(v.wordEN || '').toLowerCase();
			const th = String(v.wordTH || '').toLowerCase();
			if (!en.includes(q) && !th.includes(q)) return false;
			if (en === correct) return false;      // ห้ามเท่าคำตอบถูก
			if (taken.has(en)) return false;       // ห้ามซ้ำช่องอื่นในข้อเดียวกัน
			return true;
		})
		.slice(0, 8);
	if (!matches.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
	box.innerHTML = matches.map((m) =>
		`<button type="button" class="mi-dist-sug-item" data-uid="${uid}" data-di="${di}" data-en="${escHtml(m.wordEN)}">`
		+ `<strong>${escHtml(m.wordEN)}</strong><span> — ${escHtml(m.wordTH || '—')}</span></button>`
	).join('');
	box.classList.remove('hidden');
	box.style.cssText = 'position:absolute;z-index:50;left:0;right:44px;top:100%;background:#fff;border:1px solid #e0e0f5;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);max-height:220px;overflow:auto;padding:4px;display:flex;flex-direction:column;gap:2px;';
}

// คลิกนอกช่อง → ปิด suggest ทั้งหมด
document.addEventListener('click', (e) => {
	if (!e.target.closest('.mi-dist-row')) {
		exItemList.querySelectorAll('.mi-dist-suggest').forEach((el) => el.classList.add('hidden'));
	}
});

function getCleanManualItems() {
	return exManualItems.map(it => {
		const { _uid, ...rest } = it;
		// ตัดช่องว่าง/ค่าว่างของ distractors ก่อนส่ง backend (กันส่ง ['', ...])
		if (Array.isArray(rest.distractors)) {
			rest.distractors = rest.distractors.map((d) => String(d ?? '').trim()).filter(Boolean);
		}
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
		markFormDirty(); // สร้างแบบฝึกหัดแล้วยังไม่ได้บันทึก → นับเป็นข้อมูลค้างอยู่
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

// ── Table actions: edit / delete (ปุ่ม “ดู” ถูกนำออกแล้ว) ─────────────────
// ปุ่ม Edit → เปิด editor ใหม่รายหมวดตาม category ของชุดนั้น
// (vocab → หน้าแบบฝึกหัดคำศัพท์, tense → หน้าชุด Tense, listening → หน้าการฟังและการดู Tense)

document.getElementById('exercises-tbody').addEventListener('click', async (e) => {
	const editBtn   = e.target.closest('.ex-edit-btn');
	const deleteBtn = e.target.closest('.ex-delete-btn');
	if (!editBtn && !deleteBtn) return;

	if (editBtn) {
		const id = editBtn.dataset.id;
		const row = allExerciseRows.find(r => r.id === id);
		if (!row) { alert('ไม่พบข้อมูลชุดนี้'); return; }
		const category = row.category || '';
		try {
			const token = getAdminToken();
			const headers = { Authorization: 'Bearer ' + token };
			if (category === 'tense') {
				const res = await fetch('/api/admin/tense-sets/' + id, { headers });
				const data = await res.json().catch(() => null);
				if (!res.ok || !data?.success) {
					throw new Error(data?.error || `HTTP ${res.status}: ${res.statusText}`);
				}
				navigateToSection('tense');
				openTenseSetModal('edit', data.data);
			} else if (category === 'listening') {
				const res = await fetch('/api/admin/listening-reading-sets/' + id, { headers });
				const data = await res.json().catch(() => null);
				if (!res.ok || !data?.success) {
					throw new Error(data?.error || `HTTP ${res.status}: ${res.statusText}`);
				}
				navigateToSection('listening-reading');
				openLRSetPage('edit', data.data);
			} else if (category === 'vocab') {
				const res = await fetch('/api/admin/vocabulary-sets', { headers });
				const data = await res.json();
				const set = (data.data || []).find((s) => s.id === id);
				if (!set) { alert('ไม่พบข้อมูลชุดนี้'); return; }
				navigateToSection('vocabulary');
				fillVocabSetEditForm(set);
				showVocabSetEdit(); // opens on Step 1 (Matching) for review
			} else {
				alert('ชุดนี้ไม่มีประเภทที่รองรับการแก้ไข (' + (category || 'ไม่ระบุ') + ')');
			}
		} catch (err) {
			alert('เปิดหน้าแก้ไขไม่สำเร็จ: ' + err.message);
		}
		return;
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

// email(lower) → ชื่อผู้ใช้ (join จาก /api/admin/users แล้ว cache ไว้ ไม่ยิงซ้ำตอนค้นหา/เปลี่ยนหน้า)
let statUserNameCache = null;

async function getStatUserNameMap() {
	if (statUserNameCache) return statUserNameCache;
	const map = new Map();
	const put = (email, name) => {
		const key = (email || '').trim().toLowerCase();
		if (key && name && !map.has(key)) map.set(key, name);
	};
	try {
		const headers = await getAuthHeaders();
		const res = await fetch('/api/admin/users', { headers });
		const data = await res.json();
		if (data.success && Array.isArray(data.data)) {
			data.data.forEach(u => put(u.email, u.name || u.displayName || u.username));
			statUserNameCache = map;
			return statUserNameCache;
		}
		throw new Error(data.error || 'Unexpected users API response');
	} catch (err) {
		console.error('[stats] users API failed, falling back:', err.message);
	}
	// Fallback 1: รายชื่อสมาชิกที่เคยโหลดไว้ในหน้านี้แล้ว
	try {
		if (typeof allUserRows !== 'undefined' && Array.isArray(allUserRows) && allUserRows.length) {
			allUserRows.forEach(u => put(u.email, u.name || u.displayName || u.username));
			if (map.size) { statUserNameCache = map; return statUserNameCache; }
		}
	} catch (_) { /* ignore */ }
	// Fallback 2: อ่าน Firestore users ตรง (อาจติด rules แต่ลองไว้ก่อน)
	try {
		const snap = await getDocs(query(collection(db, 'users'), limit(MAX_ADMIN_ROWS)));
		snap.docs.map(d => ({ id: d.id, ...d.data() }))
			.forEach(u => put(u.email, u.name || u.displayName || u.username));
	} catch (err2) {
		console.error('[stats] Firestore users fallback failed:', err2.message);
	}
	statUserNameCache = map;
	return statUserNameCache;
}

// ลำดับเดียวกับ renderUsersPage: name → displayName → username (ไม่เจอ → '—')
function resolveStatUserName(row, map) {
	const key = (row?.email || '').trim().toLowerCase();
	if (key && map && map.has(key)) return map.get(key);
	return row?.username || row?.displayName || row?.name || '—';
}

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
		// rows come from backend Admin API first (Admin SDK bypasses Firestore read rules)
		allStatRows = await fetchExerciseStatsRows();
		allStatRows.sort((a, b) => (getCreatedAtSeconds(b.createdAt) ?? 0) - (getCreatedAtSeconds(a.createdAt) ?? 0));
		await getStatUserNameMap().catch(() => null);
		renderExerciseStatsPage(tbody, pagin, countEl, statPage);
		loading.classList.add('hidden');
		table.classList.remove('hidden');
	} catch (err) {
		if (isQuotaError(err)) {
			loading.textContent = quotaLoadMessage(err);
			return;
		}
		if (isPermissionError(err)) {
			loading.textContent = 'โหลดข้อมูลไม่สำเร็จ: ไม่มีสิทธิ์อ่านข้อมูลสถิติ — ตรวจสอบว่า backend รันอยู่ (GET /api/admin/statistics) หรือตรวจ Firestore Rules แล้วลองใหม่';
			return;
		}
		loading.textContent = quotaLoadMessage(err);
	}
}

// ดึงแถวสถิติ: 1) backend Admin API (Admin SDK ข้าม rules) 2) fallback อ่าน Firestore ตรง
async function fetchExerciseStatsRows() {
	// 1) Primary: backend Admin API - Admin SDK bypasses Firestore read rules
	//    (rules ของ statistics อนุญาตเฉพาะเจ้าของ -> admin อ่านตรงจาก client ไม่ได้)
	let apiErr = null;
	try {
		const headers = await getAuthHeaders();
		const res = await fetch('/api/admin/statistics?limit=' + MAX_ADMIN_ROWS, { headers });
		const data = await res.json().catch(() => ({}));
		if (res.ok && data.success && Array.isArray(data.data)) return data.data;
		throw new Error(data.error || 'HTTP ' + res.status);
	} catch (err) {
		apiErr = err;
		console.warn('[stats] statistics API failed, falling back to client SDK:', err.message);
	}

	// 2) Fallback: direct Firestore SDK (ใช้ได้เฉพาะ environment ที่ rules เปิดอ่าน)
	try {
		// limit + orderBy: กันดึง collection statistics ทั้งหมด (โตกว่า 5000 แถว → เกินเพดานอ่าน)
		const snap = await getDocs(
			query(collection(db, 'statistics'), orderBy('createdAt', 'desc'), limit(MAX_ADMIN_ROWS))
		);
		return snap.docs.map(d => ({ id: d.id, ...d.data() }));
	} catch (err) {
		// failed-precondition = composite index ยังไม่ถูกสร้าง → ลองใหม่แบบไม่มี orderBy
		if (err.code === 'failed-precondition') {
			try {
				const snap = await getDocs(query(collection(db, 'statistics'), limit(MAX_ADMIN_ROWS)));
				return snap.docs.map(d => ({ id: d.id, ...d.data() }));
			} catch (retryErr) {
				err = retryErr;
			}
		}
		// ทั้ง API และ fallback ล้มเหลว → แนบเหตุผลจาก API ไปด้วย (เช่น backend ไม่รัน)
		if (apiErr && isPermissionError(err)) {
			throw new Error('statistics API: ' + apiErr.message + ' / Firestore: ' + err.message);
		}
		throw err;
	}
}

function renderExerciseStatsPage(tbody, pagin, countEl, page) {
	// ช่องค้นหารวม: อีเมลหรือชื่อผู้ใช้ (fallback ช่องเก่า 2 ช่อง กัน browser cache HTML เก่า)
	const qFilter = document.getElementById('stats-filter-q')?.value.trim().toLowerCase()
		|| document.getElementById('stats-filter-email')?.value.trim().toLowerCase()
		|| document.getElementById('stats-filter-username')?.value.trim().toLowerCase()
		|| '';
	const catFilter   = document.getElementById('stats-filter-cat')?.value || '';
	const nameMap     = statUserNameCache || new Map();

	let rows = allStatRows;
	if (qFilter) rows = rows.filter(r =>
		(r.email || '').toLowerCase().includes(qFilter) ||
		resolveStatUserName(r, nameMap).toLowerCase().includes(qFilter)
	);
	if (catFilter)   rows = rows.filter(r => r.category === catFilter);

	const start = (page - 1) * STAT_PAGE_SIZE;
	const slice = rows.slice(start, start + STAT_PAGE_SIZE);

	tbody.innerHTML = slice.map((d, i) => {
		const passed = d.passed
			? '<span style="color:#2e7d32;font-weight:600">Pass</span>'
			: '<span style="color:#c62828">Fail</span>';
		const date = formatThaiDateTime(d.createdAt);
		return `
			<tr>
				<td>${start + i + 1}</td>
				<td>${d.email || '—'}</td>
				<td>${resolveStatUserName(d, nameMap)}</td>
				<td><ion-icon name="${CAT_ICONS[d.category] || 'library-outline'}"></ion-icon> ${CAT_NAMES[d.category] || d.category || '—'}</td>
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
	const runStatsSearch = () => {
		renderExerciseStatsPage(
			document.getElementById('stats-tbody'),
			document.getElementById('stats-pagination'),
			document.getElementById('stats-count'),
			1
		);
	};
	statsSearchBtn.addEventListener('click', runStatsSearch);
	['stats-filter-q', 'stats-filter-email', 'stats-filter-username'].forEach(id => {
		document.getElementById(id)?.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') { e.preventDefault(); runStatsSearch(); }
		});
	});
}

// ══════════════════════════════════════════════════════════════════════════
// Vocab CRUD
// ══════════════════════════════════════════════════════════════════════════

let allVocabRows = [];
let vocabSearch = '';

// กรองคลังคำศัพท์ด้วยคำค้น: ค้นได้ทั้งคำอังกฤษ (wordEN) และคำแปลไทย (wordTH)
function filterVocabRows() {
	const q = vocabSearch.trim().toLowerCase();
	if (!q) return allVocabRows;
	return allVocabRows.filter((v) =>
		String(v.wordEN || '').toLowerCase().includes(q) ||
		String(v.wordTH || '').toLowerCase().includes(q));
}

// วาดตารางคำศัพท์จากรายการที่ผ่านการกรอง (หมายเลข # นับตามผลค้นหา)
function renderVocabRows() {
	const tbody = document.getElementById('vocab-tbody');
	if (!tbody) return;

	const rows = filterVocabRows();
	if (rows.length === 0) {
		tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;padding:18px;">ไม่พบคำศัพท์ที่ค้นหา</td></tr>';
		return;
	}

	tbody.innerHTML = rows.map((v, i) => `
		<tr>
			<td>${i + 1}</td>
			<td><strong>${v.wordEN || '—'}</strong></td>
			<td>${v.wordTH || '—'}</td>
			<td>
				<button class="btn-action edit vocab-edit-btn" data-id="${v.id}"><ion-icon name="create-outline"></ion-icon> Edit</button>
				<button class="btn-action delete vocab-delete-btn" data-id="${v.id}" data-word="${v.wordEN || ''}"><ion-icon name="trash-outline"></ion-icon> ลบ</button>
			</td>
		</tr>`).join('');
}

// ช่องค้นหาคำศัพท์: พิมพ์ปุบกรองทันที
document.getElementById('vocab-search')?.addEventListener('input', (e) => {
	vocabSearch = e.target.value || '';
	renderVocabRows();
});

async function loadVocab() {
	const loading = document.getElementById('vocab-loading');
	const table   = document.getElementById('vocab-table');

	loading.classList.remove('hidden');
	table.classList.add('hidden');

	try {
		const snap = await getDocs(query(collection(db, 'vocabulary'), limit(MAX_ADMIN_ROWS)));
		allVocabRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
		allVocabRows.sort((a, b) => (a.wordEN || '').localeCompare(b.wordEN || ''));
		invalidateVocabSuggestCache(); // คลังเปลี่ยน → autocomplete รอบหน้าจะโหลดใหม่

		renderVocabRows(); // คงคำค้นหาที่พิมพ์ไว้แล้วไว้ (เผื่อเพิ่ม/แก้/ลบแล้วโหลดใหม่)

		loading.classList.add('hidden');
		table.classList.remove('hidden');
	} catch (err) {
		loading.textContent = quotaLoadMessage(err);
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
const vocabSuggestList = document.getElementById('vocab-suggest-list');
const vocabWordENHint = document.getElementById('vocab-wordEN-hint');

// ══════════════════════════════════════════════════════════════════════════
// ตรวจสถานะคำศัพท์ที่พิมพ์: มีอยู่ในคลังแล้วหรือยัง
// พิมพ์ "app" → dropdown รายการคำที่ขึ้นต้นด้วย app (reuse cache ของ Vocab Set)
// พิมพ์ตรงกับคำในคลังเป๊ะ → ขึ้นข้อความ "มีในคลังแล้ว" ให้แอดมินรู้ว่าอยู่ในระบบแล้ว
// (เป็นระบบแจ้งเตือนเท่านั้น ไม่ได้บล็อกการบันทึก)
// ══════════════════════════════════════════════════════════════════════════
let vocabModalSuggestDebounce = null;

function closeVocabSuggest() {
	if (vocabSuggestList) {
		vocabSuggestList.classList.add('hidden');
		vocabSuggestList.innerHTML = '';
	}
}

function hideVocabHint() {
	if (!vocabWordENHint) return;
	vocabWordENHint.classList.add('hidden');
	vocabWordENHint.textContent = '';
	vocabWordENHint.classList.remove('exists', 'similar', 'new-word');
}

function showVocabHint(state, html) {
	if (!vocabWordENHint) return;
	vocabWordENHint.className = 'vocab-dup-hint ' + state;
	vocabWordENHint.innerHTML = html; // รองรับ <ion-icon> (ข้อความ dynamic ถูก escHtml ที่จุดเรียก)
}

// คำที่พิมพ์ตรงกับคำในคลังเป๊ะ (ไม่สนตัวพิมพ์) — คืนรายการทั้งหมดที่ตรงกัน
function findExactVocabMatches(q) {
	const key = (q || '').trim().toLowerCase();
	if (!key) return [];
	return vocabSuggestCache.filter((v) => v.wordEN.toLowerCase() === key);
}

// วาด dropdown คำที่แนะนำ
function renderVocabModalSuggest(matches) {
	if (!vocabSuggestList) return;
	if (!matches.length) {
		closeVocabSuggest();
		return;
	}
	vocabSuggestList.innerHTML = matches.map((m) =>
		'<button type="button" class="pair-suggest-item" data-en="' + escHtml(m.wordEN) + '"'
		+ ' data-th="' + escHtml(m.wordTH || '') + '">'
		+ '<strong>' + escHtml(m.wordEN) + '</strong>'
		+ '<span>' + escHtml(m.wordTH || '—') + '</span>'
		+ '</button>'
	).join('');
	vocabSuggestList.classList.remove('hidden');
}

// ประมวลผลทุกครั้งที่พิมพ์: อัปเดตทั้ง dropdown และข้อความสถานะ
async function updateVocabModalSuggest(rawValue) {
	const q = (rawValue || '').trim();
	if (!q) {
		closeVocabSuggest();
		hideVocabHint();
		return;
	}

	await ensureVocabSuggestCache();

	const exactMatches = findExactVocabMatches(q);
	// คำที่กำลังแก้ไขอยู่ (doc เดียวกับที่เปิด modal) = ไม่ถือว่าเป็นคำซ้ำ
	const otherDuplicates = exactMatches.filter((m) => !vocabDocId.value || m.id !== vocabDocId.value);
	const isEditingSameWord = exactMatches.some((m) => m.id === vocabDocId.value && vocabDocId.value);

	renderVocabModalSuggest(getVocabSuggestMatches(q));

	if (otherDuplicates.length > 0) {
		showVocabHint('exists',
			'<ion-icon name="checkmark-circle-outline"></ion-icon> คำนี้มีอยู่ในคลังคำศัพท์แล้ว'
			+ (otherDuplicates[0].wordTH ? ' — คำแปลที่มี: ' + escHtml(otherDuplicates[0].wordTH) : '')
			+ (otherDuplicates.length > 1 ? ' (พบ ' + otherDuplicates.length + ' รายการ)' : ''));
	} else if (isEditingSameWord) {
		showVocabHint('similar', '<ion-icon name="create-outline"></ion-icon> กำลังแก้ไขคำนี้อยู่ในระบบ');
	} else if (exactMatches.length === 0 && getVocabSuggestMatches(q).length > 0) {
		showVocabHint('similar', '<ion-icon name="search-outline"></ion-icon> ใกล้เคียง — ยังไม่พบคำนี้ตรงเป๊ะในคลัง (เลือกจากรายการด้านบน หรือพิมพ์คำใหม่)');
	} else {
		showVocabHint('new-word', '<ion-icon name="add-circle-outline"></ion-icon> ไม่พบในคลังคำศัพท์ — จะเพิ่มเป็นคำใหม่');
	}
}

vocabWordEN?.addEventListener('input', (e) => {
	clearTimeout(vocabModalSuggestDebounce);
	const el = e.target;
	vocabModalSuggestDebounce = setTimeout(async () => {
		if (!el.isConnected) return;      // modal ถูกปิดไปแล้วระหว่างรอ → ทิ้งผลลัพธ์
		await updateVocabModalSuggest(el.value);
	}, 150);
});

// คลิกเลือกคำจาก dropdown → เติม wordEN เสมอ, เติม wordTH เฉพาะช่องที่ยังว่าง
vocabSuggestList?.addEventListener('mousedown', (e) => {
	const item = e.target.closest('.pair-suggest-item');
	if (!item) return;
	e.preventDefault(); // กัน input blur ก่อน click มาถึงปุ่ม
	vocabWordEN.value = item.dataset.en || '';
	if (!vocabWordTH.value.trim() && item.dataset.th) vocabWordTH.value = item.dataset.th;
	closeVocabSuggest();
	hideVocabHint();
	vocabWordEN.focus();
});

// คลิกที่อื่นนอกช่องพิมพ์ → ปิด dropdown (ไม่ล้างข้อความสถานะไว้ให้ admin เห็น)
document.addEventListener('mousedown', (e) => {
	if (vocabModal && vocabModal.classList.contains('hidden')) return;
	if (e.target.closest && e.target.closest('#vocab-modal .pair-suggest-wrap')) return;
	closeVocabSuggest();
});

function openVocabModal(mode, data = {}) {
	resetFormDirty(); // เปิดฟอร์มใหม่ → เริ่มต้น isFormDirty = false
	vocabModalTitle.textContent = mode === 'add' ? 'Add vocabulary' : 'Edit vocabulary';
	vocabDocId.value    = data.id || '';
	vocabWordEN.value   = data.wordEN || '';
	vocabWordTH.value   = data.wordTH || '';
	vocabTtsVoice.value = data.ttsVoice || '';
	vocabError.classList.add('hidden');
	closeVocabSuggest();
	hideVocabHint();
	vocabModal.classList.remove('hidden');
	// โหลดคลังล่วงหน้า เพื่อให้ dropdown + ข้อความสถานะพร้อมใช้ทันทีที่พิมพ์
	ensureVocabSuggestCache();
}

document.getElementById('add-vocab-btn').addEventListener('click', () => openVocabModal('add'));
function closeVocabModal() { vocabModal.classList.add('hidden'); resetFormDirty(); }
vocabCancelBtn.addEventListener('click', () => guardedClose(closeVocabModal));
vocabModal.addEventListener('click', (e) => { if (e.target === vocabModal) guardedClose(closeVocabModal); });

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
		closeVocabModal();
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
		const token = getAdminToken();
		const res = await fetch('/api/admin/vocabulary-sets', { headers: { Authorization: 'Bearer ' + token } });
		const data = await res.json();
		if (!data.success) throw new Error(data.error);
		tbody.innerHTML = '';
		let i = 1;
		data.data.forEach((d) => {
			const tr = document.createElement('tr');
			tr.innerHTML = '<td>' + (i++) + '</td><td><strong>' + d.title + '</strong></td><td>' + (d.totalQuestions ?? d.items?.length ?? 0) + '</td><td><span class="status-badge ' + d.status + ' status-toggle" data-id="' + d.id + '" data-status="' + d.status + '">' + (d.status === 'published' ? 'เผยแพร่' : 'ร่าง') + '</span></td><td><button class="btn-edit vocabset-edit-btn" data-id="' + d.id + '"><ion-icon name="create-outline"></ion-icon></button><button class="btn-delete vocabset-del-btn" data-id="' + d.id + '"><ion-icon name="trash-outline"></ion-icon></button></td>';
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

// Helper: แปลงประเภท Tense จากข้อความ legacy (เช่น 'Present Simple', 'Past Continuous') -> 'Present' | 'Past' | 'Future'
function deriveTenseTagFromItem(it, fallback = 'Present') {
	const raw = String(it?.tenseIndicator || it?.tenseType || '').trim();
	if (raw.startsWith('Past')) return 'Past';
	if (raw.startsWith('Future')) return 'Future';
	if (raw.startsWith('Present')) return 'Present';
	return fallback;
}

// Adapter: แปลง item ให้รองรับทั้ง schema เก่า (sentence, answer, orderWords, speakText, tenseType)
// และ schema ใหม่ (mode, targetSentence, missingWord, correctAnswer, tenseIndicator)
// โดยคง fields เดิมไว้ครบ (...it) เพื่อให้ฝั่ง User app ยังทำงานได้หลังบันทึก
function normalizeTenseItemForEdit(it, defaultTag, defaultVoice) {
	const sentence = String(it.sentence || '').trim();
	const hasBlank = /_{2,}/.test(sentence);
	const orderWords = Array.isArray(it.orderWords) ? it.orderWords : [];
	const scrambledWords = Array.isArray(it.scrambledWords) && it.scrambledWords.length > 0
		? it.scrambledWords
		: (orderWords.length > 0 ? orderWords.slice() : []);

	// ตัดสิน mode:
	// 1) ถ้ามี it.mode อยู่แล้วและตรงตัว → ใช้ต่อ
	// 2) ถ้ามีประโยคพร้อมช่องว่าง ___ → fillBlank
	// 3) ถ้ามี orderWords → reorder
	// 4) ถ้ามีแค่ speakText → listenRepeat
	let mode = it.mode;
	if (!mode || !['reorder', 'fillBlank', 'listenRepeat'].includes(mode)) {
		if (hasBlank) mode = 'fillBlank';
		else if (orderWords.length > 0) mode = 'reorder';
		else if (it.speakText) mode = 'listenRepeat';
		else mode = 'reorder';
	}

	// targetSentence:
	// - fillBlank: ใช้ sentence ที่มี ___
	// - reorder / listenRepeat: ใช้ speakText หรือ join orderWords หรือ targetSentence เดิม
	let targetSentence = String(it.targetSentence || '').trim();
	if (!targetSentence) {
		if (mode === 'fillBlank' && sentence) {
			targetSentence = sentence;
		} else if (it.speakText) {
			targetSentence = String(it.speakText).trim();
		} else if (orderWords.length > 0) {
			targetSentence = orderWords.join(' ');
		} else if (sentence) {
			targetSentence = sentence;
		}
	}

	// "คำในช่องว่าง" คือคำเดียวกันทั้งคู่ — correctAnswer เป็นค่าหลัก missingWord sync ตามเสมอ
	// (fallback จาก missingWord/answer เผื่อชุดเก่าที่ค่าอาจอยู่แค่ฝั่งเดียว)
	const correctAnswer = String(it.correctAnswer || it.missingWord || it.answer || '').trim();
	const missingWord = correctAnswer;
	const answer = correctAnswer;

	const tenseIndicator = deriveTenseTagFromItem(it, defaultTag);
	const ttsVoice = (it.ttsVoice === 'male' || it.ttsVoice === 'female') ? it.ttsVoice : defaultVoice;

	// distractors: คำตอบที่ผิด 2 ช่อง (โหมด fillBlank)
	// - ถ้ามีอยู่แล้ว → ใช้ค่าเดิม
	// - ชุดเก่าที่ยังไม่มี → derive จาก choices เดิม (ตัดคำตอบถูกออก เอา 2 ค่าแรก)
	// เติม '' ให้ครบ 2 slot เสมอ เพื่อให้ผู้ดูแลแก้ไขช่องที่ยังว่างได้
	let distractors;
	if (Array.isArray(it.distractors)) {
		distractors = it.distractors.slice(0, 2).map((d) => String(d ?? '').trim());
	} else {
		const wrongs = (Array.isArray(it.choices) ? it.choices : [])
			.map((c) => String(c ?? '').trim())
			.filter((c) => c && c.toLowerCase() !== correctAnswer.toLowerCase());
		distractors = wrongs.slice(0, 2);
	}
	while (distractors.length < 2) distractors.push('');

	return {
		...it, // รักษา legacy fields: tenseType, tenseColor, exampleEN, exampleTH, choices, answer, sentence, orderWords, speakText
		_uid: crypto.randomUUID(),
		mode,
		targetSentence,
		sentenceTH: String(it.sentenceTH || '').trim(),
		scrambledWords,
		missingWord,
		correctAnswer,
		tenseIndicator,
		ttsVoice,
		distractors,
	};
}

function openTenseSetModal(mode, data = {}) {
	resetFormDirty(); // เปิดฟอร์มใหม่ → เริ่มต้น isFormDirty = false
	document.getElementById('tenseset-modal-title').textContent = mode === 'add' ? 'สร้างชุด Tense' : 'แก้ไขชุด Tense';
	tensesetEditId = data.id || null;
	tensesetTitle.value = data.title || '';

	// ดึง tenseTag จาก data หรือ derive จาก item แรกถ้าเป็นข้อมูล legacy
	let initialTag = data.tenseTag;
	if (!initialTag && Array.isArray(data.items) && data.items.length > 0) {
		initialTag = deriveTenseTagFromItem(data.items[0], 'Present');
	}
	if (!initialTag) initialTag = 'Present';
	if (tensesetTag) tensesetTag.value = initialTag;

	tensesetDesc.value = data.description || '';
	tensesetPubToggle.checked = data.status === 'published';
	document.getElementById('tenseset-toggle-label').textContent = tensesetPubToggle.checked ? 'เผยแพร่ทันที' : 'บันทึกเป็นแบบร่าง';
	tensesetErr.classList.add('hidden');
	
	const defaultTag = tensesetTag ? tensesetTag.value : 'Present';
	// เสียงอ่านไม่ได้ตั้งระดับชุดแล้ว (กำหนดรายข้อใน Step 2 ตอนสร้างโจทย์)
	// เก็บค่า fallback จากข้อมูลเดิม เพื่อ normalize item เก่าที่ยังไม่มี ttsVoice
	const defaultVoice = data.ttsSystem === 'male' ? 'male' : 'female';
	
	tensesetItems = [];
	if (data.items && Array.isArray(data.items)) {
		tensesetItems = data.items.map(it => normalizeTenseItemForEdit(it, defaultTag, defaultVoice));
	} else {
		// สร้างใหม่: เริ่มที่ 1 ข้อ ให้ผู้ดูแลเพิ่ม/ลดจำนวนเองได้ (บันทึกได้กี่ข้อก็ได้)
		for (let i = 0; i < 1; i++) {
			tensesetItems.push({
				_uid: crypto.randomUUID(),
				mode: 'reorder',
				targetSentence: '',
				sentenceTH: '',
				scrambledWords: [],
				missingWord: '',
				correctAnswer: '',
				distractors: ['', ''],
				tenseIndicator: defaultTag,
				ttsVoice: defaultVoice
			});
		}
	}

	// สอดคล้องกับ Step 2 (สร้างโจทย์)
	setTenseSetStep(1);
	renderTenseSetItems();
	if (tensesetSection) tensesetSection.classList.add('hidden');
	if (tensesetEditSection) tensesetEditSection.classList.remove('hidden');
	window.scrollTo(0, 0);
	setTopbarBackVisible(true); // เข้าโหมดเพิ่ม/แก้ไข → แสดงปุ่ม ← กลับ บน topbar
}

function closeTenseSetModal() {
	if (tensesetEditSection) tensesetEditSection.classList.add('hidden');
	if (tensesetSection) tensesetSection.classList.remove('hidden');
	setTopbarBackVisible(false); // กลับหน้ารายการ → ซ่อนปุ่ม ← กลับ บน topbar
	resetFormDirty(); // ปิดฟอร์มแล้ว (รวมตอนบันทึกสำเร็จ) → ไม่มีข้อมูลค้าง
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
			`<button type="button" class="tense-delete-btn" data-uid="${item._uid}" style="background:#ff3b30;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"><ion-icon name="trash-outline"></ion-icon> ลบ</button>`;
		card.appendChild(header);
		
		// แถวตั้งค่าข้อ: รูปแบบฝึก (3-57) + ประเภท Tense (6.2.2/6.2.3) + เสียงอ่าน (4.4)
		const metaRow = document.createElement('div');
		metaRow.style.display = 'grid';
		metaRow.style.gridTemplateColumns = 'repeat(auto-fit, minmax(180px, 1fr))';
		metaRow.style.gap = '10px';
		metaRow.style.marginBottom = '12px';
		metaRow.innerHTML = `
			<div>
				<label style="display:block;margin-bottom:4px;font-weight:500;font-size:13px;">รูปแบบฝึก: <span style="color:red;">*</span></label>
				<select class="tense-mode-select" data-uid="${item._uid}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;font-size:13px;">
					<option value="reorder" ${item.mode === 'reorder' ? 'selected' : ''}>เรียงประโยค (Reordering)</option>
					<option value="fillBlank" ${item.mode === 'fillBlank' ? 'selected' : ''}>เติมคำในช่องว่าง (Fill-in-blank)</option>
					<option value="listenRepeat" ${item.mode === 'listenRepeat' ? 'selected' : ''}>ฟังและพูดตาม (Listen & Repeat)</option>
				</select>
			</div>
			<div>
				<label style="display:block;margin-bottom:4px;font-weight:500;font-size:13px;">ประเภท Tense ของข้อ: <span style="color:red;">*</span></label>
				<select class="tense-indicator" data-uid="${item._uid}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;font-size:13px;">
					<option value="Present" ${item.tenseIndicator === 'Present' ? 'selected' : ''}>Present</option>
					<option value="Past" ${item.tenseIndicator === 'Past' ? 'selected' : ''}>Past</option>
					<option value="Future" ${item.tenseIndicator === 'Future' ? 'selected' : ''}>Future</option>
				</select>
			</div>
			<div>
				<label style="display:block;margin-bottom:4px;font-weight:500;font-size:13px;">เสียงอ่าน (ชาย/หญิง):</label>
				<select class="tense-voice" data-uid="${item._uid}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;font-size:13px;">
					<option value="female" ${item.ttsVoice === 'female' ? 'selected' : ''}>เสียงผู้หญิง (Female)</option>
					<option value="male" ${item.ttsVoice === 'male' ? 'selected' : ''}>เสียงผู้ชาย (Male)</option>
				</select>
			</div>
		`;
		card.appendChild(metaRow);
		
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
				<div style="margin-bottom:8px;">
					<label style="display:block;margin-bottom:4px;">คำในช่องว่าง: <span style="color:red;">*</span></label>
					<small style="color:#666;display:block;margin-bottom:6px;">คือคำที่แทนที่ช่องว่าง _____ ในประโยค (คำตอบที่ถูก)</small>
					<div class="pair-suggest-wrap">
						<input type="text" class="tense-answer tense-word-suggest" data-uid="${item._uid}" value="${escHtml(item.correctAnswer || item.missingWord || '')}" autocomplete="off"
							placeholder="เช่น went" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" />
						<div class="pair-suggest-list hidden"></div>
					</div>
				</div>
				<div style="margin-bottom:4px;">
					<label style="display:block;margin-bottom:4px;">คำตอบที่ผิด (2 ช่อง) <span style="color:red;">*</span></label>
					<small style="color:#666;display:block;margin-bottom:6px;">ผู้เรียนจะเห็นคำตอบถูก + คำตอบผิด 2 คำ เป็นตัวเลือกให้เลือก</small>
					<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
						${[0, 1].map((di) => `
						<div class="pair-suggest-wrap">
							<input type="text" class="tense-wrong tense-word-suggest" data-uid="${item._uid}" data-didx="${di}" value="${escHtml((item.distractors && item.distractors[di]) || '')}" autocomplete="off"
								placeholder="เช่น ${di === 0 ? 'goes' : 'going'}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;" />
							<div class="pair-suggest-list hidden"></div>
						</div>`).join('')}
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

function showTenseErr(message, itemUid = null) {
	tensesetErr.textContent = message;
	tensesetErr.classList.remove('hidden');
	tensesetErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
	// ไฮไลต์การ์ดข้อที่มีปัญหา เพื่อให้ผู้ดูแลรู้ว่าต้องไปแก้ข้อไหน
	if (itemUid) {
		const card = tensesetItemList.querySelector('.tense-item-card[data-uid="' + itemUid + '"]');
		if (card) {
			card.scrollIntoView({ behavior: 'smooth', block: 'center' });
			card.style.outline = '2px solid #ff3b30';
			setTimeout(() => { card.style.outline = ''; }, 2500);
		}
	}
}

document.getElementById('tenseset-cancel-btn')?.addEventListener('click', () => guardedClose(closeTenseSetModal));

tensesetPubToggle?.addEventListener('change', () => {
	document.getElementById('tenseset-toggle-label').textContent = tensesetPubToggle.checked ? 'เผยแพร่ทันที' : 'บันทึกเป็นแบบร่าง';
});

// Wizard navigation (Step 1 → 2)
document.getElementById('tenseset-next-btn-s1')?.addEventListener('click', () => {
	if (!tensesetTitle.value.trim()) {
		showTenseErr('กรุณากรอกชื่อชุด');
		return;
	}
	tensesetErr.classList.add('hidden');
	setTenseSetStep(2);
});
document.getElementById('tenseset-prev-btn-s2')?.addEventListener('click', () => setTenseSetStep(1));

document.getElementById('tenseset-add-item-btn')?.addEventListener('click', () => {
	const defaultTag = tensesetTag ? tensesetTag.value : 'Present';
	const defaultVoice = 'female'; // ผู้ดูแลเลือกเสียงรายข้อได้ที่ select ใน Step 2
	tensesetItems.push({
		_uid: crypto.randomUUID(),
		mode: 'reorder',
		targetSentence: '',
		sentenceTH: '',
		scrambledWords: [],
		missingWord: '',
		correctAnswer: '',
		distractors: ['', ''],
		tenseIndicator: defaultTag,
		ttsVoice: defaultVoice
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
	} else if (e.target.classList.contains('tense-answer')) {
		// ช่อง "คำในช่องว่าง" เดียว — คำที่หายไป กับ คำตอบที่ถูก คือคำเดียวกัน → sync ทั้งสอง field
		item.correctAnswer = e.target.value;
		item.missingWord = e.target.value;
	} else if (e.target.classList.contains('tense-wrong')) {
		const di = parseInt(e.target.dataset.didx, 10);
		if (Number.isInteger(di) && di >= 0 && di < 2) {
			if (!Array.isArray(item.distractors)) item.distractors = ['', ''];
			item.distractors[di] = e.target.value;
		}
	}
});

// ── Autocomplete คำตอบจากคลังคำศัพท์ (reuse cache ของ Vocab Set) ────────────
// ใช้กับช่องคำของโหมด fillBlank: คำในช่องว่าง / คำตอบที่ผิด 2 ช่อง
// พิมพ์เองได้เสมอ — dropdown เป็นตัวช่วยเลือกคำจาก collection `vocabulary`
function closeTenseSuggest() {
	tensesetItemList.querySelectorAll('.pair-suggest-list').forEach(el => el.classList.add('hidden'));
}

function renderTenseSuggest(inputEl, matches) {
	const wrap = inputEl.closest('.pair-suggest-wrap');
	if (!wrap) return;
	const list = wrap.querySelector('.pair-suggest-list');
	if (!list) return;
	if (!matches.length) {
		list.classList.add('hidden');
		list.innerHTML = '';
		return;
	}
	list.innerHTML = matches.map((m) =>
		'<button type="button" class="pair-suggest-item" data-en="' + escHtml(m.wordEN) + '"'
		+ ' data-th="' + escHtml(m.wordTH || '') + '">'
		+ '<strong>' + escHtml(m.wordEN) + '</strong>'
		+ '<span>' + escHtml(m.wordTH || '—') + '</span>'
		+ '</button>'
	).join('');
	list.classList.remove('hidden');
}

let tenseSuggestDebounce = null;
tensesetItemList?.addEventListener('input', (e) => {
	const inputEl = e.target;
	if (!inputEl.classList.contains('tense-word-suggest')) return;
	clearTimeout(tenseSuggestDebounce);
	tenseSuggestDebounce = setTimeout(async () => {
		await ensureVocabSuggestCache();
		if (!inputEl.isConnected) return; // การ์ดถูกลบ/re-render ระหว่างรอ → ทิ้ง
		renderTenseSuggest(inputEl, getVocabSuggestMatches(inputEl.value));
	}, 150);
});

tensesetItemList?.addEventListener('focusin', async (e) => {
	const inputEl = e.target;
	if (!inputEl.classList.contains('tense-word-suggest')) return;
	await ensureVocabSuggestCache();
	if (!inputEl.isConnected) return;
	renderTenseSuggest(inputEl, getVocabSuggestMatches(inputEl.value));
});

tensesetItemList?.addEventListener('click', (e) => {
	const suggestBtn = e.target.closest('.pair-suggest-item');
	if (suggestBtn) {
		const inputEl = suggestBtn.closest('.pair-suggest-wrap')?.querySelector('input');
		if (!inputEl) return;
		inputEl.value = suggestBtn.dataset.en || '';
		// อัปเดต model ให้ตรงกับค่าที่เลือก (เหมือนผู้ดูแลพิมพ์เอง)
		inputEl.dispatchEvent(new Event('input', { bubbles: true }));
		closeTenseSuggest();
		return;
	}
});

// ปิด dropdown เมื่อคลิกที่อื่นนอกช่องคำของ Tense (ไม่กิน handler ของ Vocab Set)
document.addEventListener('mousedown', (e) => {
	if (!tensesetItemList || tensesetItemList.classList.contains('hidden')) return;
	if (e.target.closest && e.target.closest('#tenseset-item-editor-list .pair-suggest-wrap')) return;
	closeTenseSuggest();
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
	if (tensesetItems.length <= 1) {
		alert('ต้องมีอย่างน้อย 1 ข้อ');
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
		showTenseErr('กรุณากรอกชื่อชุด');
		return;
	}
	
	if (tensesetItems.length < 1) {
		showTenseErr(`ต้องมีอย่างน้อย 1 ข้อ (ปัจจุบัน ${tensesetItems.length} ข้อ)`);
		return;
	}
	
	for (let i = 0; i < tensesetItems.length; i++) {
		const item = tensesetItems[i];
		if (!item.targetSentence || !item.targetSentence.trim()) {
			showTenseErr(`ข้อที่ ${i + 1}: กรุณากรอกประโยค`, item._uid);
			return;
		}
		if (item.mode === 'fillBlank' && (!item.correctAnswer || !item.correctAnswer.trim())) {
			showTenseErr(`ข้อที่ ${i + 1}: กรุณากรอกคำในช่องว่าง`, item._uid);
			return;
		}
		// โหมด fillBlank: ต้องมีคำตอบผิดครบ 2 ช่อง และห้ามซ้ำกับคำตอบถูก / ซ้ำกันเอง
		if (item.mode === 'fillBlank') {
			const wrongs = (Array.isArray(item.distractors) ? item.distractors : [])
				.map((d) => String(d || '').trim());
			if (!wrongs[0] || !wrongs[1]) {
				showTenseErr(`ข้อที่ ${i + 1}: กรุณากรอกคำตอบที่ผิดให้ครบ 2 ช่อง`, item._uid);
				return;
			}
			const ansKey = item.correctAnswer.trim().toLowerCase();
			if (wrongs.some((w) => w.toLowerCase() === ansKey)) {
				showTenseErr(`ข้อที่ ${i + 1}: คำตอบที่ผิดต้องไม่เท่ากับคำตอบที่ถูก`, item._uid);
				return;
			}
			if (wrongs[0].toLowerCase() === wrongs[1].toLowerCase()) {
				showTenseErr(`ข้อที่ ${i + 1}: คำตอบที่ผิดทั้ง 2 ช่องต้องไม่ซ้ำกัน`, item._uid);
				return;
			}
			item.distractors = wrongs;
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
		// "คำในช่องว่าง" คำเดียวกัน → missingWord sync กับ correctAnswer เสมอ ก่อนส่ง backend
		nItem.missingWord = (nItem.correctAnswer || '').trim();
	}
	
	const items = tensesetItems.map(item => {
		const { _uid, _scrambleTimer, ...rest } = item;
		return rest;
	});
	
	const payload = {
		title,
		tenseTag: tensesetTag ? tensesetTag.value : 'Present',
		// ไม่มีช่องกรอกเสียงระดับชุดแล้ว — ใช้เสียงของข้อแรกเป็นค่า fallback ของชุด
		// (เสียงจริงที่ผู้เรียนได้ยินมาจาก item.ttsVoice ที่กำหนดรายข้อใน Step 2)
		ttsSystem: items[0]?.ttsVoice === 'male' ? 'male' : 'female',
		description: tensesetDesc.value.trim(),
		status: tensesetPubToggle.checked ? 'published' : 'draft',
		items,
		updatedAt: serverTimestamp()
	};
	
	if (!tensesetEditId) {
		payload.createdAt = serverTimestamp();
	}
	
	try {
		const token = getAdminToken();
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
		
		const data = await res.json().catch(() => null);
		if (!res.ok || !data?.success) {
			// รายงานสาเหตุชัดเจน (เช่น 401 token หมดอายุ, 422 validation, 500 server)
			throw new Error(`HTTP ${res.status}${data?.error ? ': ' + data.error : ''}`);
		}
		
		closeTenseSetModal();
		await loadTenseSets();
		await loadStats();
		alert('บันทึกชุด Tense สำเร็จ!');
	} catch (err) {
		showTenseErr('บันทึกล้มเหลว: ' + err.message);
	}
});

async function loadTenseSets() {
	const loading = document.getElementById('tenseset-loading');
	const table = document.getElementById('tenseset-table');
	const tbody = document.getElementById('tenseset-tbody');
	loading.classList.remove('hidden'); table.classList.add('hidden');
	try {
		const token = getAdminToken();
		const res = await fetch('/api/admin/tense-sets', { headers: { Authorization: 'Bearer ' + token } });
		const data = await res.json();
		if (!data.success) throw new Error(data.error);
		tbody.innerHTML = '';
		let i = 1;
		data.data.forEach((d) => {
			const tr = document.createElement('tr');
			tr.innerHTML = '<td>' + (i++) + '</td><td><strong>' + d.title + '</strong></td><td>' + (d.items ? d.items.length : 0) + '</td><td><span class="status-badge ' + d.status + ' status-toggle" data-id="' + d.id + '" data-status="' + d.status + '">' + (d.status === 'published' ? 'เผยแพร่' : 'ร่าง') + '</span></td><td><button class="btn-edit tenseset-edit-btn" data-id="' + d.id + '"><ion-icon name="create-outline"></ion-icon></button><button class="btn-delete tenseset-del-btn" data-id="' + d.id + '"><ion-icon name="trash-outline"></ion-icon></button></td>';
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
			const token = getAdminToken();
			const res = await fetch(`/api/admin/tense-sets/${id}`, {
				headers: { Authorization: 'Bearer ' + token }
			});
			const data = await res.json().catch(() => null);
			if (!res.ok || !data?.success) {
				throw new Error(data?.error || `HTTP ${res.status}: ${res.statusText}`);
			}
			openTenseSetModal('edit', data.data);
		} catch (err) {
			alert('เปิดหน้าแก้ไขไม่สำเร็จ: ' + err.message);
		}
	}
	
	if (delBtn) {
		if (!confirm('ลบชุด Tense นี้?')) return;
		const id = delBtn.dataset.id;
		try {
			const token = getAdminToken();
			const res = await fetch(`/api/admin/tense-sets/${id}`, {
				method: 'DELETE',
				headers: { Authorization: 'Bearer ' + token }
			});
			const data = await res.json();
			if (!data.success) throw new Error(data.error);
			await loadTenseSets();
			await loadStats();
			alert('ลบชุด Tense สำเร็จ');
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
	loading.textContent = 'กำลังโหลด...';
	table.classList.add('hidden');

	// แสดง `username` แทนอีเมล — fallback ตัด @domain ออกจาก email/doc.id
	// เช่น `admin01@gmail.com` → `admin01` (ข้อมูลเก่าที่ไม่มีฟิลด์ username)
	const toDisplayUsername = (row) => {
		const direct = row && typeof row.username === 'string' ? row.username.trim() : '';
		if (direct) return direct;
		const source = (row && typeof row.email === 'string' && row.email.trim())
			? row.email.trim()
			: String(row?.id ?? '');
		const at = source.indexOf('@');
		return (at > 0 ? source.slice(0, at) : source).trim() || String(row?.id ?? '');
	};

	const renderRows = (rows) => {
		tbody.innerHTML = '';
		let i = 1;
		const savedUsername = getAdminUsername().toLowerCase();
		rows.forEach((row) => {
			const docId = String(row.id ?? '');
			const displayUsername = toDisplayUsername(row);
			const isSelf = (savedUsername && (docId === savedUsername || displayUsername.toLowerCase() === savedUsername))
				|| docId === auth.currentUser?.email?.toLowerCase();
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td>${i++}</td>
				<td><strong>${escapeHtml(displayUsername)}</strong>${isSelf ? ' <span style="color:#5B4FCF;font-size:11px">(you)</span>' : ''}</td>
			`;
			tbody.appendChild(tr);
		});

		loading.classList.add('hidden');
		table.classList.remove('hidden');
	};

	try {
		// 1) Primary: backend Admin API → ได้ฟิลด์ `username` พร้อมใช้
		const token = getAdminToken();
		const res = await fetch('/api/admin/admins', { headers: { Authorization: 'Bearer ' + token } });
		const data = await res.json();
		if (data.success && Array.isArray(data.data)) {
			renderRows(data.data);
			return;
		}
		throw new Error(data.error || 'Unexpected admins API response');
	} catch (err) {
		console.warn('[loadAdmins] Backend admins API failed, falling back to client SDK:', err.message);
	}

	try {
		const snap = await getDocs(query(collection(db, 'admins'), limit(100)));
		renderRows(snap.docs.map((d) => ({ id: d.id, email: d.id, ...d.data() })));
	} catch (err) {
		loading.textContent = quotaLoadMessage(err);
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

const addAdminBtn = document.getElementById('add-admin-btn');
if (addAdminBtn) addAdminBtn.addEventListener('click', () => {
	resetFormDirty(); // เปิดฟอร์มใหม่ → เริ่มต้น isFormDirty = false
	adminEmailInp.value = '';
	adminNameInp.value  = '';
	adminRoleInp.value  = 'admin';
	adminError.classList.add('hidden');
	adminModal.classList.remove('hidden');
});

function closeAdminModal() { adminModal.classList.add('hidden'); resetFormDirty(); }
adminCancelBtn.addEventListener('click', () => guardedClose(closeAdminModal));
adminModal.addEventListener('click', (e) => { if (e.target === adminModal) guardedClose(closeAdminModal); });

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
		closeAdminModal();
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
let vocabsetSpellingSel = new Map();   // Step 2 live selection: wordEN -> wordTH (คงค่าข้าม Step)
let vocabsetListenSel = new Map();     // Step 3 live selection: wordEN -> wordTH (คงค่าข้าม Step)
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
			// เก็บ id ไว้ด้วย เพื่อให้ modal คลังคำศัพท์แยกได้ว่าคำที่พิมพ์คือ "คำเดิมที่กำลังแก้" หรือ "คำซ้ำ"
			if (Array.isArray(allVocabRows) && allVocabRows.length > 0) {
				vocabSuggestCache = allVocabRows
					.filter(v => v && (v.wordEN || '').trim())
					.map(v => ({ id: v.id || '', wordEN: String(v.wordEN).trim(), wordTH: String(v.wordTH || '').trim() }));
			} else {
				const snap = await getDocs(query(collection(db, 'vocabulary'), limit(MAX_ADMIN_ROWS)));
				vocabSuggestCache = snap.docs
					.filter(d => d.data() && (d.data().wordEN || '').trim())
					.map(d => ({ id: d.id || '', wordEN: String(d.data().wordEN).trim(), wordTH: String(d.data().wordTH || '').trim() }));
			}
			vocabSuggestCache.sort((a, b) => a.wordEN.toLowerCase().localeCompare(b.wordEN.toLowerCase()));
		} catch (err) {
			console.error('[vocabSuggest] load failed:', isQuotaError(err) ? 'โควต้า Firebase เต็ม' : err.message);
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
	resetFormDirty(); // เปิดฟอร์มใหม่ → เริ่มต้น isFormDirty = false
	vocabsetSection.classList.add('hidden');
	vocabsetEditSection.classList.remove('hidden');
	showVocabStep(1); // always open on Step 1 (Matching) for review
	setTopbarBackVisible(true); // เข้าโหมดเพิ่ม/แก้ไข → แสดงปุ่ม ← กลับ บน topbar
}
function hideVocabSetEdit() {
	vocabsetSection.classList.remove('hidden');
	vocabsetEditSection.classList.add('hidden');
	setTopbarBackVisible(false); // กลับหน้ารายการ → ซ่อนปุ่ม ← กลับ บน topbar
	resetFormDirty(); // ปิดฟอร์มแล้ว (รวมตอนบันทึกสำเร็จ) → ไม่มีข้อมูลค้าง
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
		// ผูกกับ state กลาง: render ใหม่ทุกครั้งที่สลับ Step → คืนค่าจาก Map เสมอ
		if (vocabsetSpellingSel.has(pair.wordEN.trim())) checkbox.checked = true;
		checkbox.addEventListener('change', () => {
			if (checkbox.checked) vocabsetSpellingSel.set(pair.wordEN.trim(), pair.wordTH.trim());
			else vocabsetSpellingSel.delete(pair.wordEN.trim());
			updateSpellingCount();
		});

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

// อ่าน selection จาก state กลาง (กรองคำที่ถูกลบ/กรอกไม่ครบใน Step 1 แล้วออกอัตโนมัติ)
function readWordSelection(selMap) {
	const byEN = new Map(vocabsetItems
		.filter(it => it && it.wordEN && it.wordTH && it.wordEN.trim() && it.wordTH.trim())
		.map(it => [it.wordEN.trim(), it.wordTH.trim()]));
	for (const key of Array.from(selMap.keys())) {
		if (!byEN.has(key)) selMap.delete(key);
	}
	return Array.from(selMap.keys()).map((wordEN) => ({ wordEN, wordTH: byEN.get(wordEN) }));
}

function getSelectedSpellingWords() {
	return readWordSelection(vocabsetSpellingSel);
}

function resetVocabSetForm() {
	vocabsetEditId = null;
	vocabsetSpellingSel = new Map();
	vocabsetListenSel = new Map();
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

document.getElementById('vocabset-cancel-btn').addEventListener('click', () => guardedClose(hideVocabSetEdit));
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
	vocabsetSentenceRows.push({ linkIdx: vocabsetItems.length - 1, sentence: '', sentenceTH: '', distractors: ['', ''] });
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
		// ผูกกับ state กลาง: render ใหม่ทุกครั้งที่สลับ Step → คืนค่าจาก Map เสมอ
		if (vocabsetListenSel.has(pair.wordEN.trim())) checkbox.checked = true;
		checkbox.addEventListener('change', () => {
			if (checkbox.checked) vocabsetListenSel.set(pair.wordEN.trim(), pair.wordTH.trim());
			else vocabsetListenSel.delete(pair.wordEN.trim());
			updateListenCount();
		});

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
	return readWordSelection(vocabsetListenSel);
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
		// normalize distractors state — dynamic 0-2 ช่อง ([] = ไม่กำหนด → สุ่มอัตโนมัติตอนสอบ)
		if (!Array.isArray(r.distractors)) r.distractors = [];
		r.distractors = r.distractors.slice(0, 2).map((d) => String(d ?? ''));
		const row = document.createElement('div');
		row.className = 'fib-row';
		row.dataset.row = String(k);
		row.innerHTML = '<span class="pair-num">' + (k + 1) + '</span>'
			+ '<select class="fib-word-select" data-row="' + k + '" title="เลือกคำศัพท์จากรายการ">'
			+ buildFibWordOptions(r.linkIdx)
			+ '</select>'
			+ '<input type="text" data-row="' + k + '" data-field="sentence" value="' + (r.sentence || '') + '" placeholder="I eat an apple every day." />'
			+ '<input type="text" data-row="' + k + '" data-field="sentenceTH" value="' + (r.sentenceTH || '') + '" placeholder="ฉันกินแอปเปิ้ลทุกวัน" />'
			+ '<div class="fib-distr-wrap" style="grid-column:1 / -1;display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;padding-top:6px;">'
			+ '<span style="font-size:12px;color:#6b7280;white-space:nowrap;padding-top:6px;">คำตอบหลอก (พิมพ์ค้นหาจากคลังคำศัพท์):</span>'
			+ '<div class="fib-dist-list" style="display:flex;flex-direction:column;gap:6px;flex:1;min-width:260px;position:relative;">'
			+ (r.distractors.length
				? r.distractors.map((d, di) =>
					'<div class="fib-dist-row" data-row="' + k + '" data-di="' + di + '" style="display:flex;gap:8px;align-items:center;position:relative;">'
					+ '<input type="text" class="fib-dist-input" data-row="' + k + '" data-di="' + di + '" value="' + escHtml(d) + '" placeholder="พิมพ์เพื่อค้นหา เช่น bag" autocomplete="off" style="flex:1;" />'
					+ '<button type="button" class="fib-dist-del" data-row="' + k + '" data-di="' + di + '" title="ลบคำตอบหลอกนี้" style="border:1px solid #f0caca;background:#fff5f5;color:#d63031;border-radius:8px;padding:6px 10px;cursor:pointer;">🗑</button>'
					+ '<div class="fib-dist-suggest pair-suggest-list hidden" data-row="' + k + '" data-di="' + di + '"></div>'
					+ '</div>').join('')
				: '<div style="font-size:11px;color:#9ca3af;padding:6px 0;">— ไม่กำหนด (สุ่มอัตโนมัติ) —</div>')
			+ '</div>'
			+ '<button type="button" class="fib-dist-add" data-row="' + k + '"' + (r.distractors.length >= 2 ? ' disabled' : '')
			+ ' style="border:1px dashed #5B4FCF;background:#EEF0FF;color:#5B4FCF;border-radius:8px;padding:6px 12px;font-size:13px;cursor:'
			+ (r.distractors.length >= 2 ? 'not-allowed' : 'pointer') + ';opacity:' + (r.distractors.length >= 2 ? '0.5' : '1') + ';">+ เพิ่มคำตอบหลอก</button>'
			+ '<span style="font-size:11px;color:#9ca3af;padding-top:6px;">สูงสุด 2 ช่อง · เว้นว่าง = สุ่มอัตโนมัติ</span>'
			+ '</div>';
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
// No duplicate restriction: each FIB row may select the same word.
function buildFibWordOptions(selectedIdx) {
	let opts = '<option value="-1" disabled' + (selectedIdx < 0 || !vocabsetItems[selectedIdx] ? ' selected' : '') + '>— เลือกคำศัพท์ (EN) —</option>';
	vocabsetItems.forEach((it, idx) => {
		const label = (it.wordEN || '').trim();
		const sel = idx === selectedIdx ? ' selected' : '';
		if (!label) {
			opts += '<option value="' + idx + '" disabled>ข้อ ' + (idx + 1) + ': ยังไม่กรอก EN</option>';
		} else {
			opts += '<option value="' + idx + '"' + sel + '>' + label + ' — ข้อ ' + (idx + 1) + '</option>';
		}
	});
	return opts;
}

// Autocomplete คำตอบหลอก (Step 4): ดึงรายการคำศัพท์จากคลังคำศัพท์หลัก
// ผ่าน ensureVocabSuggestCache() (collection `vocabulary`) — ไม่ใช่แค่คำในชุด Step 1
// ค้นแบบ prefix (wordEN.startsWith) ตรงกับ Step 1 — ไม่ค้นแบบ substring/คำไทย
// กันซ้ำ: ห้ามเท่าคำตอบถูกของแถวนี้ และห้ามซ้ำกับช่องอื่นในแถวเดียวกัน
async function renderFibDistSuggest(rowIdx, di, text) {
	const box = vocabsetFibList.querySelector('.fib-dist-suggest[data-row="' + rowIdx + '"][data-di="' + di + '"]');
	if (!box) return;
	const q = String(text ?? '').trim().toLowerCase();
	if (!q) { box.classList.add('hidden'); box.innerHTML = ''; return; }
	const cache = await ensureVocabSuggestCache();
	// ระหว่างรอ cache แถวอาจถูก re-render/ลบ → ทิ้ง (ตามแบบ Step 1/tense suggest)
	if (!box.isConnected) return;
	const r = vocabsetSentenceRows[rowIdx];
	const correct = (r && r.linkIdx >= 0 && vocabsetItems[r.linkIdx])
		? (vocabsetItems[r.linkIdx].wordEN || '').trim().toLowerCase() : '';
	const taken = new Set((r && Array.isArray(r.distractors) ? r.distractors : [])
		.map((d, j) => (j === di ? null : String(d ?? '').trim().toLowerCase()))
		.filter(Boolean));
	const matches = (Array.isArray(cache) ? cache : [])
		.map((v) => ({ en: String(v.wordEN || '').trim(), th: String(v.wordTH || '').trim() }))
		.filter((v) => {
			const en = v.en.toLowerCase();
			if (!en) return false;
			if (!en.startsWith(q)) return false; // prefix match เท่านั้น (ตรงกับ Step 1)
			if (en === correct) return false;    // ห้ามเท่าคำตอบถูก
			if (taken.has(en)) return false;     // ห้ามซ้ำช่องอื่นในแถวเดียวกัน
			return true;
		})
		.slice(0, 8);
	if (!matches.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
	// layout แบบ Step 1: EN ซ้าย (<strong>), TH ขวา (<span>) — styling มาจาก .pair-suggest-item
	box.innerHTML = matches.map((m) =>
		'<button type="button" class="pair-suggest-item fib-dist-sug-item" data-row="' + rowIdx + '" data-di="' + di + '" data-en="' + escHtml(m.en) + '">'
		+ '<strong>' + escHtml(m.en) + '</strong>'
		+ '<span>' + escHtml(m.th || '—') + '</span></button>'
	).join('');
	box.classList.remove('hidden');
}

vocabsetFibList.addEventListener('input', (e) => {
	const row = e.target.closest('.fib-row');
	if (!row) return;
	const k = parseInt(row.dataset.row, 10);
	// พิมพ์ในช่องคำตอบหลอก → เก็บลง state + เปิด autocomplete จากคำศัพท์ Step 1
	const distInp = e.target.closest('.fib-dist-input');
	if (distInp) {
		const di = parseInt(distInp.dataset.di, 10);
		const r = vocabsetSentenceRows[k];
		if (!r) return;
		if (!Array.isArray(r.distractors)) r.distractors = [];
		r.distractors[di] = distInp.value;
		renderFibDistSuggest(k, di, distInp.value);
		return;
	}
	const field = e.target.dataset.field;
	if (!field) return;
	if (vocabsetSentenceRows[k]) vocabsetSentenceRows[k][field] = e.target.value;
});

// Dropdown change links the sentence row to the chosen master word.
vocabsetFibList.addEventListener('change', (e) => {
	const sel = e.target.closest('.fib-word-select');
	if (!sel) return;
	const k = parseInt(sel.dataset.row, 10);
	const changed = vocabsetSentenceRows[k];
	if (!changed) return;
	changed.linkIdx = parseInt(sel.value, 10);
	// เปลี่ยนคำตอบถูก → ตัดคำตอบหลอกที่เท่ากับคำใหม่ออก (เก็บช่องว่างที่กำลังกรอกไว้)
	if (Array.isArray(changed.distractors)) {
		const correct = (changed.linkIdx >= 0 && vocabsetItems[changed.linkIdx]
			? (vocabsetItems[changed.linkIdx].wordEN || '') : '').trim().toLowerCase();
		changed.distractors = changed.distractors
			.filter((d) => String(d ?? '').trim().toLowerCase() !== correct);
	}
	// render ใหม่ → select คำศัพท์ + ช่องคำตอบหลอก (dynamic) + autocomplete ตรงกับ state ล่าสุด
	renderVocabSetSentences();
});

// Dynamic distractors (Step 4): เพิ่ม/ลบช่อง + เลือกจาก autocomplete (สูงสุด 2 ช่อง)
vocabsetFibList.addEventListener('click', (e) => {
	const addBtn = e.target.closest('.fib-dist-add');
	if (addBtn) {
		const k = parseInt(addBtn.dataset.row, 10);
		const r = vocabsetSentenceRows[k];
		if (!r) return;
		if (!Array.isArray(r.distractors)) r.distractors = [];
		if (r.distractors.length >= 2) {
			alert('เพิ่มคำตอบหลอกได้สูงสุด 2 ช่องต่อข้อ');
			return;
		}
		r.distractors.push('');
		renderVocabSetSentences();
		const inputs = vocabsetFibList.querySelectorAll('.fib-dist-input[data-row="' + k + '"]');
		inputs[inputs.length - 1]?.focus();
		return;
	}
	const delBtn = e.target.closest('.fib-dist-del');
	if (delBtn) {
		const k = parseInt(delBtn.dataset.row, 10);
		const di = parseInt(delBtn.dataset.di, 10);
		const r = vocabsetSentenceRows[k];
		if (!r || !Array.isArray(r.distractors)) return;
		r.distractors.splice(di, 1);
		renderVocabSetSentences();
		return;
	}
	// เลือกคำจาก autocomplete → กันซ้ำกับคำตอบถูกและช่องอื่นในแถวเดียวกัน
	const sugBtn = e.target.closest('.fib-dist-sug-item');
	if (sugBtn) {
		const k = parseInt(sugBtn.dataset.row, 10);
		const di = parseInt(sugBtn.dataset.di, 10);
		const r = vocabsetSentenceRows[k];
		if (!r) return;
		if (!Array.isArray(r.distractors)) r.distractors = [];
		const val = String(sugBtn.dataset.en || '').trim();
		const low = val.toLowerCase();
		const correct = (r.linkIdx >= 0 && vocabsetItems[r.linkIdx]
			? (vocabsetItems[r.linkIdx].wordEN || '') : '').trim().toLowerCase();
		if (low === correct) {
			alert('คำตอบหลอกห้ามซ้ำกับคำตอบที่ถูกต้อง');
			return;
		}
		if (r.distractors.some((d, j) => j !== di && String(d ?? '').trim().toLowerCase() === low)) {
			alert('คำนี้เลือกไปแล้วในข้อนี้');
			return;
		}
		r.distractors[di] = val;
		renderVocabSetSentences();
	}
});

// คลิกนอกช่อง → ปิด autocomplete คำตอบหลอกทั้งหมด
document.addEventListener('click', (e) => {
	if (!e.target.closest('.fib-dist-row')) {
		vocabsetFibList.querySelectorAll('.fib-dist-suggest').forEach((el) => el.classList.add('hidden'));
	}
});

// Add new FIB sentence row (Step 4)
document.getElementById('vocabset-add-fib-btn').addEventListener('click', () => {
	if (vocabsetSentenceRows.length >= 30) {
		alert('เติมคำในช่องว่างได้สูงสุด 30 ข้อ');
		return;
	}
	vocabsetSentenceRows.push({ linkIdx: -1, sentence: '', sentenceTH: '', distractors: [] });
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
	// Each word may be used in multiple sentences. Sentences must be unique.
	const fillInBlankSentences = [];
	const seenFibSentences = new Set();
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
		const key = (s || st).toLowerCase();
		if (seenFibSentences.has(key)) {
			showVocabSetError('ข้อที่ ' + (i + 1) + ': ประโยคซ้ำกัน: "' + (s || st) + '" — กรุณาใช้ประโยคที่ไม่ซ้ำกัน');
			return;
		}
		seenFibSentences.add(key);
		// Dynamic distractors: trim → ตัดค่าว่าง → กันซ้ำ (case-insensitive) → กันเท่าคำตอบถูก → สูงสุด 2 ช่อง
		const dists = [];
		const seenDists = new Set();
		const correctLow = target.wordEN.toLowerCase();
		for (const raw of (Array.isArray(r.distractors) ? r.distractors : [])) {
			const v = String(raw ?? '').trim();
			const low = v.toLowerCase();
			if (!low || low === correctLow || seenDists.has(low)) continue;
			seenDists.add(low);
			dists.push(v);
			if (dists.length >= 2) break;
		}
		fillInBlankSentences.push({ wordEN: target.wordEN, wordTH: target.wordTH, sentence: s, sentenceTH: st, distractors: dists });

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
		const token = getAdminToken();
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
		alert('บันทึกชุดคำศัพท์สำเร็จ!');
	} catch (err) { showVocabSetError('บันทึกล้มเหลว: ' + err.message); }
});

function showVocabSetError(msg) { vocabsetErr.textContent = msg; vocabsetErr.classList.remove('hidden'); }

// เติมข้อมูลชุดคำศัพท์ลงฟอร์มแก้ไข (ใช้ร่วมกัน: หน้าหมวดคำศัพท์ + ปุ่ม Edit หน้าแบบฝึกหัดทั้งหมด)
function fillVocabSetEditForm(set) {
	vocabsetEditId = set.id;
	vocabsetPageTitle.textContent = 'แก้ไขชุดคำศัพท์';
	vocabsetTitle.value = set.title || '';
	vocabsetDesc.value = set.description || '';
	vocabsetPubToggle.checked = set.status === 'published';
	document.getElementById('vocabset-toggle-label').textContent = set.status === 'published' ? 'เผยแพร่ทันที' : 'บันทึกเป็นแบบร่าง';
	vocabsetItems = (set.items || []).map((it) => ({ ...it }));
	while (vocabsetItems.length < 4) vocabsetItems.push(newVocabSetItem());
	// Restore Step 4 FIB: ใช้ fillInBlankSentences ถ้ามี (รวม distractors) — ไม่งั้น fallback overlay จาก items
	const fib = Array.isArray(set.fillInBlankSentences)
		? set.fillInBlankSentences.filter(f => f && ((f.sentence || '').trim() || (f.sentenceTH || '').trim()))
		: [];
	if (fib.length) {
		const used = new Set();
		vocabsetSentenceRows = fib.map((f) => {
			let idx = -1;
			const w = String(f.wordEN || '').trim().toLowerCase();
			for (let i = 0; i < vocabsetItems.length; i++) {
				if (used.has(i)) continue;
				if (String(vocabsetItems[i].wordEN || '').trim().toLowerCase() === w) { idx = i; break; }
			}
			if (idx >= 0) used.add(idx);
			return {
				linkIdx: idx,
				sentence: (f.sentence || ''),
				sentenceTH: (f.sentenceTH || ''),
				distractors: Array.isArray(f.distractors) ? f.distractors.slice(0, 2) : [],
			};
		});
	} else {
		vocabsetSentenceRows = vocabsetItems.map((it, i) => ({
			linkIdx: i,
			sentence: (it.sentence || ''),
			sentenceTH: (it.sentenceTH || ''),
			distractors: Array.isArray(it.distractors) ? it.distractors.slice(0, 2) : [],
		}));
	}
	// Seed state กลางของ Checkbox (Step 2/3) จากข้อมูลที่บันทึกไว้
	vocabsetSpellingSel = new Map((set.spellingWords || []).map(w => [String(w.wordEN || '').trim(), String(w.wordTH || '').trim()]));
	vocabsetListenSel = new Map((set.listenRepeatWords || []).map(w => [String(w.wordEN || '').trim(), String(w.wordTH || '').trim()]));
	renderVocabSetPairs();
}

document.getElementById('vocabset-tbody').addEventListener('click', async (e) => {
	const editBtn = e.target.closest('.vocabset-edit-btn');
	const delBtn = e.target.closest('.vocabset-del-btn');
	if (delBtn) {
		if (!confirm('ลบชุดคำศัพท์นี้?')) return;
		try { const token = getAdminToken(); await fetch('/api/admin/vocabulary-sets/' + delBtn.dataset.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); await loadVocabSets(); }
		catch (err) { alert('ลบล้มเหลว: ' + err.message); }
	}
	if (editBtn) {
		try {
			const token = getAdminToken();
			const res = await fetch('/api/admin/vocabulary-sets', { headers: { Authorization: 'Bearer ' + token } });
			const data = await res.json();
			const set = data.data.find((s) => s.id === editBtn.dataset.id);
			if (!set) return;
			fillVocabSetEditForm(set);
			showVocabSetEdit(); // opens on Step 1 (Matching) for review
		} catch (err) { alert('โหลดข้อมูลล้มเหลว: ' + err.message); }
	}
});

// ── Listening/Reading Sets: setup (full-page wizard) ─────────────────────
const lrsetSection = document.getElementById('section-listening-reading');
const lrsetEditSection = document.getElementById('section-lrset-edit');
const lrsetPageTitle = document.getElementById('lrset-page-title');
const lrsetTitle = document.getElementById('lrset-title');
const lrsetLevel = document.getElementById('lrset-level');
const lrsetDesc = document.getElementById('lrset-description');
const lrsetSpeakerAName = document.getElementById('lrset-speakerA-name');
const lrsetSpeakerATts = document.getElementById('lrset-speakerA-tts');
const lrsetSpeakerBName = document.getElementById('lrset-speakerB-name');
const lrsetSpeakerBTts = document.getElementById('lrset-speakerB-tts');
const lrsetPubToggle = document.getElementById('lrset-publish-toggle');
const lrsetErr = document.getElementById('lrset-error');
const lrsetDialogueList = null; // (เลิกใช้ — ใช้ lrsetDialogueCards แทน)
const lrsetQuestionList = null; // (เลิกใช้ — คำถามอยู่ในการ์ดแต่ละใบ)
const lrsetDialogueCards = document.getElementById('lrset-dialogue-cards');
const lrsetDialogueCount = document.getElementById('lrset-dialogue-count');
const lrsetAddDialogueBtn = document.getElementById('lrset-add-dialogue-btn');
// เลขบทสนทนาสูงสุด 3 ชุด เส้นต่อชุดอย่างน้อย 2 บรรทัด
const LR_MAX_DIALOGUES = 3;
const LR_MIN_LINES = 2;

function makeEmptyLRDialogue() {
  return {
    _uid: (window.crypto?.randomUUID ? window.crypto.randomUUID() : 'lr_' + Date.now() + '_' + Math.random().toString(36).slice(2)),
    lines: [{ speaker: 'A', text: '' }, { speaker: 'B', text: '' }],
    quickSpeaker: 'A',
    question: { prompt: '', options: ['', '', '', ''], correctIndex: 0 },
  };
}

// แปลงข้อมูล (รูปแบบใหม่ dialogues[] / รูปแบบเก่า dialogue[]+questions[]) → การ์ด
function normalizeLRDialogues(data = {}) {
  if (Array.isArray(data.dialogues) && data.dialogues.length) {
    return data.dialogues.slice(0, LR_MAX_DIALOGUES).map((d) => ({
      _uid: (window.crypto?.randomUUID ? window.crypto.randomUUID() : 'lr_' + Date.now() + '_' + Math.random().toString(36).slice(2)),
      lines: Array.isArray(d.lines) && d.lines.length
        ? d.lines.map((l) => ({ speaker: l && l.speaker === 'B' ? 'B' : 'A', text: (l && l.text) || '' }))
        : [{ speaker: 'A', text: '' }, { speaker: 'B', text: '' }],
      quickSpeaker: 'A',
      question: {
        prompt: (d.question && d.question.prompt) || '',
        options: Array.isArray(d.question && d.question.options)
          ? d.question.options.concat(['', '', '', '']).slice(0, 4)
          : ['', '', '', ''],
        correctIndex: typeof (d.question && d.question.correctIndex) === 'number' ? d.question.correctIndex : 0,
      },
    }));
  }
  // รูปแบบเก่า: dialogue[] ชุดเดียว + questions[] N ข้อ → การ์ดละ 1 คำถาม (ใช้บทสนทนาเดิม)
  const legacyLines = Array.isArray(data.dialogue) && data.dialogue.length
    ? data.dialogue.map((l) => ({ speaker: l && l.speaker === 'B' ? 'B' : 'A', text: (l && l.text) || '' }))
    : [{ speaker: 'A', text: '' }, { speaker: 'B', text: '' }];
  const legacyQs = Array.isArray(data.questions) && data.questions.length ? data.questions : [{}];
  return legacyQs.slice(0, LR_MAX_DIALOGUES).map((q) => ({
    _uid: (window.crypto?.randomUUID ? window.crypto.randomUUID() : 'lr_' + Date.now() + '_' + Math.random().toString(36).slice(2)),
    lines: legacyLines.map((l) => ({ ...l })),
    quickSpeaker: 'A',
    question: {
      prompt: (q && q.prompt) || '',
      options: Array.isArray(q && q.options) ? q.options.concat(['', '', '', '']).slice(0, 4) : ['', '', '', ''],
      correctIndex: typeof (q && q.correctIndex) === 'number' ? q.correctIndex : 0,
    },
  }));
}

let lrsetDialogues = [makeEmptyLRDialogue()];
let lrsetEditId = null;

// Sync ปุ่ม pill หญิง/ชาย ให้ตรงกับค่าใน input ซ่อน
function syncLRGenderPills() {
	document.querySelectorAll('.lr-gender-pills').forEach((group) => {
		const target = document.getElementById(group.dataset.target);
		const val = target ? target.value : '';
		group.querySelectorAll('.lr-gender-pill').forEach((pill) => {
			pill.classList.toggle('active', pill.dataset.value === val);
		});
	});
}

function openLRSetPage(mode, data = {}) {
	resetFormDirty(); // เปิดฟอร์มใหม่ → เริ่มต้น isFormDirty = false
	lrsetEditId = data.id || null;
	lrsetPageTitle.textContent = mode === 'add' ? 'สร้างชุดการฟังและการดู Tense' : 'แก้ไขชุดการฟังและการดู Tense';
	lrsetTitle.value = data.title || '';
	lrsetLevel.value = data.level || 'A2';
	lrsetDesc.value = data.description || '';
	lrsetSpeakerAName.value = data.speakerA?.name || 'Speaker A';
	lrsetSpeakerATts.value = data.speakerA?.ttsVoice === 'female' ? 'female' : 'male';
	lrsetSpeakerBName.value = data.speakerB?.name || 'Speaker B';
	lrsetSpeakerBTts.value = data.speakerB?.ttsVoice === 'male' ? 'male' : 'female';
	lrsetPubToggle.checked = data.status === 'published';
	document.getElementById('lrset-toggle-label').textContent = lrsetPubToggle.checked ? 'เผยแพร่ทันที' : 'บันทึกเป็นแบบร่าง';

	lrsetDialogues = normalizeLRDialogues(data);

	lrsetErr.classList.add('hidden');

	syncLRGenderPills();
	renderLRDialogueCards();

	setLRStep(1);
	if (lrsetSection) lrsetSection.classList.add('hidden');
	if (lrsetEditSection) lrsetEditSection.classList.remove('hidden');
	window.scrollTo(0, 0);
	setTopbarBackVisible(true); // เข้าโหมดเพิ่ม/แก้ไข → แสดงปุ่ม ← กลับ บน topbar
}

function closeLRSetPage() {
	if (lrsetEditSection) lrsetEditSection.classList.add('hidden');
	if (lrsetSection) lrsetSection.classList.remove('hidden');
	setTopbarBackVisible(false); // กลับหน้ารายการ → ซ่อนปุ่ม ← กลับ บน topbar
	resetFormDirty(); // ปิดฟอร์มแล้ว (รวมตอนบันทึกสำเร็จ) → ไม่มีข้อมูลค้าง
}

function setLRStep(n) {
	for (let i = 1; i <= 3; i++) {
		const pane = document.getElementById('lrset-step-' + i);
		if (pane) pane.classList.toggle('hidden', i !== n);
		const ind = document.getElementById('lr-wiz-' + i);
		if (ind) {
			ind.classList.toggle('active', i === n);
			ind.classList.toggle('done', i < n);
		}
	}
}

document.getElementById('add-lrset-btn').addEventListener('click', () => openLRSetPage('add'));
document.getElementById('add-lrset-fab')?.addEventListener('click', () => openLRSetPage('add'));

document.getElementById('lrset-cancel-btn').addEventListener('click', () => guardedClose(closeLRSetPage));

lrsetPubToggle.addEventListener('change', () => {
	document.getElementById('lrset-toggle-label').textContent = lrsetPubToggle.checked ? 'เผยแพร่ทันที' : 'บันทึกเป็นแบบร่าง';
});

// ── Wizard navigation (3 ขั้น) ──
document.getElementById('lrset-next-btn-s1').addEventListener('click', () => {
	if (!lrsetTitle.value.trim()) { showLRSetError('กรุณากรอกชื่อชุด'); return; }
	lrsetErr.classList.add('hidden');
	setLRStep(2);
});
document.getElementById('lrset-prev-btn-s2').addEventListener('click', () => setLRStep(1));
document.getElementById('lrset-next-btn-s2').addEventListener('click', () => {
	lrsetErr.classList.add('hidden');
	setLRStep(3);
});
document.getElementById('lrset-prev-btn-s3').addEventListener('click', () => setLRStep(2));

// ── Gender pills (หญิง/ชาย) ──
document.querySelectorAll('.lr-gender-pills').forEach((group) => {
	group.addEventListener('click', (e) => {
		const pill = e.target.closest('.lr-gender-pill');
		if (!pill) return;
		const target = document.getElementById(group.dataset.target);
		if (target) target.value = pill.dataset.value;
		group.querySelectorAll('.lr-gender-pill').forEach((p) => p.classList.toggle('active', p === pill));
		renderLRDialogueCards();
	});
});

[lrsetSpeakerAName, lrsetSpeakerBName].forEach((el) => {
	el.addEventListener('input', () => { renderLRDialogueCards(); });
});

// ══════════════════════════════════════════════════════════════════════════
// Dialogue cards: 1 การ์ด = 1 บทสนทนา (เส้นสนทนา) + คำถาม 1 ข้อ
// ══════════════════════════════════════════════════════════════════════════

// ชื่อผู้พูดปัจจุบัน (อ่านสดทุกครั้งเพื่อให้ตามหลังช่องกรอก)
function getLRDialogueSpeakerNames() {
	return {
		A: (lrsetSpeakerAName.value || 'Speaker A').trim() || 'Speaker A',
		B: (lrsetSpeakerBName.value || 'Speaker B').trim() || 'Speaker B',
	};
}

function lrsetFindDialogue(uid) {
	return lrsetDialogues.find((d) => d._uid === uid);
}

// สร้าง HTML ภายในการ์ดบทสนทนา 1 ใบ
function buildLRDialogueCardHtml(d, di) {
	const names = getLRDialogueSpeakerNames();

	const linesHtml = d.lines.map((line, li) => (
		'<div class="form-row"><div class="form-field" style="max-width:120px;"><label>ผู้พูด</label>'
		+ '<select data-lr-role="speaker" data-li="' + li + '"><option value="A"' + (line.speaker === 'A' ? ' selected' : '') + '>A (ซ้าย)</option><option value="B"' + (line.speaker === 'B' ? ' selected' : '') + '>B (ขวา)</option></select></div>'
		+ '<div class="form-field"><label>ข้อความ <span style="color:red">*</span></label>'
		+ '<input type="text" data-lr-role="text" data-li="' + li + '" value="' + escHtml(line.text || '') + '" placeholder="พิมพ์บทสนทนา..." /></div>'
		+ '<div class="form-field" style="max-width:38px;align-self:end;"><button type="button" class="mi-delete-btn" data-lr-role="del-line" data-li="' + li + '" title="ลบบรรทัด"><ion-icon name="trash-outline"></ion-icon></button></div></div>'
	)).join('');

	const q = d.question;
	const correctVal = (q.options[q.correctIndex] || '').trim();
	const optionRows = [0, 1, 2, 3].map((oi) => {
		const checked = q.correctIndex === oi;
		return '<div class="lr-option-row' + (checked ? ' correct' : '') + '">'
			+ '<input type="radio" class="lr-option-radio" name="lr-d' + d._uid + '-correct" value="' + oi + '"' + (checked ? ' checked' : '') + ' title="ทำเป็นคำตอบที่ถูก" />'
			+ '<input type="text" class="lr-option-input" data-lr-role="opt" data-oi="' + oi + '" value="' + escHtml(q.options[oi] || '') + '" placeholder="ตัวเลือก ' + (oi + 1) + '" />'
			+ '</div>';
	}).join('');

	return '<div class="mi-header"><span class="mi-num">บทสนทนาที่ ' + (di + 1) + '</span>'
		+ (lrsetDialogues.length > 1 ? '<button type="button" class="mi-delete-btn lr-del-card-btn" data-lr-role="del-card" title="ลบบทสนทนานี้"><ion-icon name="trash-outline"></ion-icon> ลบชุดนี้</button>' : '')
		+ '</div>'
		+ '<div class="lr-card-subhead">เส้นสนทนา <span style="color:#888;font-weight:400;">(อย่างน้อย 2 บรรทัด)</span></div>'
		+ linesHtml
		+ '<div class="lr-quickadd"><div class="lr-quick-speakers">'
		+ '<button type="button" class="lr-quick-speaker' + (d.quickSpeaker === 'A' ? ' active' : '') + '" data-lr-role="qs" data-sp="A">' + escHtml(names.A) + '</button>'
		+ '<button type="button" class="lr-quick-speaker' + (d.quickSpeaker === 'B' ? ' active' : '') + '" data-lr-role="qs" data-sp="B">' + escHtml(names.B) + '</button>'
		+ '</div><div class="lr-quick-input-row">'
		+ '<input type="text" data-lr-role="qtext" placeholder="พิมพ์บทสนทนา..." />'
		+ '<button type="button" class="lr-quick-add-btn" data-lr-role="qadd" title="เพิ่มบรรทัด"><ion-icon name="add"></ion-icon></button>'
		+ '</div></div>'
		+ '<div class="lr-card-subhead">พรีวิวแชท</div><div class="chat-preview" data-lr-role="preview"></div>'
		+ '<div class="lr-card-question">'
		+ '<div class="lr-card-subhead">คำถามของบทสนทนานี้ (1 ข้อ)</div>'
		+ '<div class="form-field"><label>คำถาม <span style="color:red">*</span></label><input type="text" data-lr-role="prompt" value="' + escHtml(q.prompt || '') + '" placeholder="เช่น พวกเขากำลังพูดถึงอะไร?" /></div>'
		+ '<div class="lr-options-head">ตัวเลือก (ติ๊ก ✓ เพื่อเลือกคำตอบที่ถูก) <span style="color:red">*</span></div>'
		+ optionRows
		+ '<div class="lr-correct-bar">✓ คำตอบที่ถูก: <strong>' + (correctVal ? escHtml(correctVal) : '—') + '</strong></div>'
		+ '</div>';
}

// พรีวิวแชทภายในการ์ด (อ่านค่าจาก state)
function updateLRCardPreview(card, d) {
	const names = getLRDialogueSpeakerNames();
	const ttsA = lrsetSpeakerATts.value;
	const ttsB = lrsetSpeakerBTts.value;
	let html = '';
	d.lines.forEach((line) => {
		if (!line.text) return;
		const isA = line.speaker === 'A';
		const name = isA ? names.A : names.B;
		const tts = isA ? (ttsA === 'male' ? 'ชาย' : 'หญิง') : (ttsB === 'male' ? 'ชาย' : 'หญิง');
		const side = isA ? 'left' : 'right';
		html += '<div class="chat-bubble ' + side + '"><div class="chat-speaker"><span class="chat-avatar ' + side + '">' + (isA ? 'A' : 'B') + '</span><span class="chat-name">' + escHtml(name) + '</span><span class="voice-badge ' + (isA ? ttsA : ttsB) + '"><ion-icon name="volume-high-outline"></ion-icon> ' + tts + '</span></div><div class="chat-text">' + escHtml(line.text) + '</div></div>';
	});
	if (!html) html = '<p class="text-muted" style="text-align:center;padding:20px;">เพิ่มบทสนทนาเพื่อดูพรีวิว</p>';
	const pv = card.querySelector('[data-lr-role="preview"]');
	if (pv) pv.innerHTML = html;
}

// อัปเดตแถบ "คำตอบที่ถูก" ภายในการ์ด (ไม่ re-render ขณะพิมพ์)
function updateLRCardCorrectBar(card, d) {
	const q = d.question;
	const bar = card.querySelector('.lr-correct-bar');
	const val = (q.options[q.correctIndex] || '').trim();
	if (bar) bar.innerHTML = '✓ คำตอบที่ถูก: <strong>' + (val ? escHtml(val) : '—') + '</strong>';
	card.querySelectorAll('.lr-option-row').forEach((row, oi) => {
		row.classList.toggle('correct', oi === q.correctIndex);
	});
}

// ปุ่มเพิ่มบทสนทนา (สูงสุด LR_MAX_DIALOGUES = 3 ชุด)
lrsetAddDialogueBtn?.addEventListener('click', () => {
	if (lrsetDialogues.length >= LR_MAX_DIALOGUES) {
		showLRSetError('เพิ่มบทสนทนาได้ไม่เกิน ' + LR_MAX_DIALOGUES + ' ชุด');
		return;
	}
	lrsetErr.classList.add('hidden');
	lrsetDialogues.push(makeEmptyLRDialogue());
	renderLRDialogueCards();
});

function renderLRDialogueCards() {
	lrsetDialogueCards.innerHTML = '';
	lrsetDialogueCount.textContent = String(lrsetDialogues.length);
	if (lrsetAddDialogueBtn) lrsetAddDialogueBtn.style.display = lrsetDialogues.length >= LR_MAX_DIALOGUES ? 'none' : '';

	lrsetDialogues.forEach((d, di) => {
		const card = document.createElement('div');
		card.className = 'lr-dialogue-card';
		card.dataset.uid = d._uid;
		card.innerHTML = buildLRDialogueCardHtml(d, di);
		lrsetDialogueCards.appendChild(card);
		updateLRCardPreview(card, d);
	});
}

// Delegation ภายในคอนเทนเนอร์การ์ด
lrsetDialogueCards.addEventListener('input', (e) => {
	const card = e.target.closest('.lr-dialogue-card');
	if (!card) return;
	const d = lrsetFindDialogue(card.dataset.uid);
	if (!d) return;
	const role = e.target.dataset.lrRole;
	if (role === 'text') {
		const li = parseInt(e.target.dataset.li, 10);
		if (!isNaN(li) && d.lines[li]) d.lines[li].text = e.target.value;
		updateLRCardPreview(card, d);
	} else if (role === 'prompt') {
		d.question.prompt = e.target.value;
	} else if (role === 'opt') {
		const oi = parseInt(e.target.dataset.oi, 10);
		if (!isNaN(oi)) d.question.options[oi] = e.target.value;
		updateLRCardCorrectBar(card, d);
	}
});

lrsetDialogueCards.addEventListener('change', (e) => {
	const card = e.target.closest('.lr-dialogue-card');
	if (!card) return;
	const d = lrsetFindDialogue(card.dataset.uid);
	if (!d) return;
	const role = e.target.dataset.lrRole;
	if (role === 'speaker') {
		const li = parseInt(e.target.dataset.li, 10);
		if (!isNaN(li) && d.lines[li]) d.lines[li].speaker = e.target.value === 'B' ? 'B' : 'A';
		updateLRCardPreview(card, d);
	} else if (e.target.classList.contains('lr-option-radio')) {
		d.question.correctIndex = parseInt(e.target.value, 10) || 0;
		renderLRDialogueCards();
	}
});

lrsetDialogueCards.addEventListener('click', (e) => {
	const card = e.target.closest('.lr-dialogue-card');
	if (!card) return;
	const d = lrsetFindDialogue(card.dataset.uid);
	if (!d) return;
	const btn = e.target.closest('[data-lr-role]');
	if (!btn) return;
	const role = btn.dataset.lrRole;
	if (role === 'del-card') {
		if (lrsetDialogues.length <= 1) return;
		if (!confirm('ลบบทสนทนานี้?')) return;
		lrsetDialogues = lrsetDialogues.filter((x) => x._uid !== d._uid);
		renderLRDialogueCards();
	} else if (role === 'del-line') {
		const li = parseInt(btn.dataset.li, 10);
		if (!isNaN(li)) d.lines.splice(li, 1);
		renderLRDialogueCards();
	} else if (role === 'qs') {
		d.quickSpeaker = btn.dataset.sp === 'B' ? 'B' : 'A';
		card.querySelectorAll('.lr-quick-speaker').forEach((b) => {
			b.classList.toggle('active', b.dataset.sp === d.quickSpeaker);
		});
	} else if (role === 'qadd') {
		const input = card.querySelector('[data-lr-role="qtext"]');
		const text = (input.value || '').trim();
		if (!text) { input.focus(); return; }
		d.lines.push({ speaker: d.quickSpeaker, text });
		renderLRDialogueCards();
	}
});

lrsetDialogueCards.addEventListener('keydown', (e) => {
	if (e.target.dataset?.lrRole !== 'qtext') return;
	if (e.key !== 'Enter') return;
	e.preventDefault();
	const card = e.target.closest('.lr-dialogue-card');
	if (!card) return;
	const d = lrsetFindDialogue(card.dataset.uid);
	if (!d) return;
	const text = (e.target.value || '').trim();
	if (!text) return;
	d.lines.push({ speaker: d.quickSpeaker, text });
	renderLRDialogueCards();
});

// ── เลิกใช้ฟังก์ชันเก่า (รวมในการ์ด renderLRDialogueCards แล้ว) ──
function renderDialogueLines() {}
function renderQuestions() {}
function updateLRCorrectBar() {}
function updateLRChatPreview() { renderLRDialogueCards(); }

document.getElementById('lrset-save-btn').addEventListener('click', async () => {
	lrsetErr.classList.add('hidden');
	const title = lrsetTitle.value.trim();
	if (!title) { showLRSetError('กรุณากรอกชื่อชุด'); return; }
	if (lrsetDialogues.length < 1) { showLRSetError('ต้องมีบทสนทนาอย่างน้อย 1 ชุด'); return; }
	if (lrsetDialogues.length > LR_MAX_DIALOGUES) { showLRSetError('บทสนทนามีได้ไม่เกิน ' + LR_MAX_DIALOGUES + ' ชุด'); return; }
	const dialogues = [];
	for (let i = 0; i < lrsetDialogues.length; i++) {
		const d = lrsetDialogues[i];
		const n = i + 1;
		const lines = (d.lines || []).filter((l) => (l.text || '').trim());
		if (lines.length < LR_MIN_LINES) { showLRSetError(`บทสนทนาที่ ${n}: ต้องมีเส้นสนทนาอย่างน้อย ${LR_MIN_LINES} บรรทัด`); return; }
		const q = d.question || { prompt: '', options: [], correctIndex: 0 };
		if (!q.prompt.trim() || q.options.filter(Boolean).length < 2) { showLRSetError(`บทสนทนาที่ ${n}: ต้องกรอกคำถาม และตัวเลือกอย่างน้อย 2 ตัวเลือก`); return; }
		dialogues.push({
			lines: lines.map((l) => ({ speaker: l.speaker === 'B' ? 'B' : 'A', text: l.text.trim() })),
			question: { prompt: q.prompt.trim(), options: q.options.filter(Boolean), correctIndex: q.correctIndex },
		});
	}
	const payload = {
		title, level: lrsetLevel.value, description: lrsetDesc.value.trim(),
		speakerA: { name: (lrsetSpeakerAName.value || 'Speaker A').trim(), ttsVoice: lrsetSpeakerATts.value },
		speakerB: { name: (lrsetSpeakerBName.value || 'Speaker B').trim(), ttsVoice: lrsetSpeakerBTts.value },
		dialogues,
		status: lrsetPubToggle.checked ? 'published' : 'draft',
	};
	try {
		const token = getAdminToken();
		const url = lrsetEditId ? '/api/admin/listening-reading-sets/' + lrsetEditId : '/api/admin/listening-reading-sets';
		const res = await fetch(url, { method: lrsetEditId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(payload) });
		const data = await res.json();
		if (!data.success) throw new Error(data.error);
		closeLRSetPage();
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
		const token = getAdminToken();
		const res = await fetch('/api/admin/listening-reading-sets', { headers: { Authorization: 'Bearer ' + token } });
		const data = await res.json();
		if (!data.success) throw new Error(data.error);
		tbody.innerHTML = '';
		let i = 1;
		data.data.forEach((d) => {
			const dialCount = Array.isArray(d.dialogues) ? d.dialogues.length
				: (Array.isArray(d.questions) ? d.questions.length : 0);
			const tr = document.createElement('tr');
			tr.innerHTML = '<td>' + (i++) + '</td><td><strong>' + d.title + '</strong></td><td>' + dialCount + '</td><td><span class="status-badge ' + d.status + ' status-toggle" data-id="' + d.id + '" data-status="' + d.status + '">' + (d.status === 'published' ? 'เผยแพร่' : 'ร่าง') + '</span></td><td><button class="btn-edit lrset-edit-btn" data-id="' + d.id + '"><ion-icon name="create-outline"></ion-icon></button><button class="btn-delete lrset-del-btn" data-id="' + d.id + '"><ion-icon name="trash-outline"></ion-icon></button></td>';
			tbody.appendChild(tr);
		});
		loading.classList.add('hidden'); table.classList.remove('hidden');
	} catch (err) { loading.textContent = 'โหลดล้มเหลว: ' + err.message; }
}

document.getElementById('lrset-tbody').addEventListener('click', async (e) => {
	const editBtn = e.target.closest('.lrset-edit-btn');
	const delBtn = e.target.closest('.lrset-del-btn');
	if (delBtn) {
		if (!confirm('ลบชุดสนทนานี้?')) return;
		try { const token = getAdminToken(); await fetch('/api/admin/listening-reading-sets/' + delBtn.dataset.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); await loadLRSets(); }
		catch (err) { alert('ลบล้มเหลว: ' + err.message); }
	}
	if (editBtn) {
		try {
			const token = getAdminToken();
			const res = await fetch('/api/admin/listening-reading-sets/' + editBtn.dataset.id, {
				headers: { Authorization: 'Bearer ' + token }
			});
			const data = await res.json().catch(() => null);
			if (!res.ok || !data?.success) {
				throw new Error(data?.error || `HTTP ${res.status}: ${res.statusText}`);
			}
			openLRSetPage('edit', data.data);
		} catch (err) { alert('เปิดหน้าแก้ไขไม่สำเร็จ: ' + err.message); }
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
		const token = getAdminToken();
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


