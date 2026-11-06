// frontend/App.js
import './firebase';
import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { NavigationContainer }          from '@react-navigation/native';
import { createNativeStackNavigator }   from '@react-navigation/native-stack';
import { createBottomTabNavigator }     from '@react-navigation/bottom-tabs';
import { SafeAreaProvider }             from 'react-native-safe-area-context';
import { Ionicons }                     from '@expo/vector-icons';

import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { checkIsAdmin, getUserProfile } from './services/firestoreService';
import { BREAKPOINTS, CONTAINER_WIDTH } from './utils/responsive';
import AppErrorBoundary from './components/AppErrorBoundary';

import LoginScreen            from './screens/LoginScreen';
import RegisterScreen         from './screens/RegisterScreen';
import ForgotPasswordScreen   from './screens/ForgotPasswordScreen';
import HomeScreen             from './screens/HomeScreen';
import StatsScreen            from './screens/StatsScreen';
import ProfileScreen          from './screens/ProfileScreen';
import ExerciseListScreen     from './screens/ExerciseListScreen';
import VocabExerciseScreen    from './screens/VocabExerciseScreen';
import TenseExerciseScreen    from './screens/TenseExerciseScreen';
import ListeningExerciseScreen from './screens/ListeningExerciseScreen';
import VocabLibraryScreen     from './screens/VocabLibraryScreen';
import AdminLoginScreen       from './screens/AdminLoginScreen';
import AdminDashboardScreen   from './screens/AdminDashboardScreen';
import AdminVocabScreen       from './screens/AdminVocabScreen';
import AdminExerciseScreen    from './screens/AdminExerciseScreen';
import AdminExerciseFormScreen from './screens/AdminExerciseFormScreen';
import AdminUsersScreen       from './screens/AdminUsersScreen';

const PRIMARY = '#5B4FCF';

const AuthStack  = createNativeStackNavigator();
const MainTab    = createBottomTabNavigator();
const MainStack  = createNativeStackNavigator();
const AdminStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login"          component={LoginScreen} />
      <AuthStack.Screen name="Register"       component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="AdminLogin"     component={AdminLoginScreen} />
    </AuthStack.Navigator>
  );
}

function AdminNavigator({ user }) {
  return (
    <AdminStack.Navigator screenOptions={{ headerShown: false }}>
      <AdminStack.Screen name="AdminDashboard">
        {(props) => <AdminDashboardScreen {...props} user={user} />}
      </AdminStack.Screen>
      <AdminStack.Screen name="AdminVocab"         component={AdminVocabScreen} />
      <AdminStack.Screen name="AdminExercise"      component={AdminExerciseScreen} />
      <AdminStack.Screen name="AdminExerciseForm"  component={AdminExerciseFormScreen} />
      <AdminStack.Screen name="AdminUsers"         component={AdminUsersScreen} />
    </AdminStack.Navigator>
  );
}

function TabNavigator({ user }) {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   PRIMARY,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth:  1,
          borderTopColor:  '#eee',
          height:          60,
          paddingBottom:   8,
          paddingTop:      4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home:    focused ? 'home'      : 'home-outline',
            Stats:   focused ? 'bar-chart' : 'bar-chart-outline',
            Profile: focused ? 'person'    : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <MainTab.Screen name="Home" options={{ tabBarLabel: 'หน้าหลัก' }}>
        {(props) => <HomeScreen {...props} user={user} />}
      </MainTab.Screen>
      <MainTab.Screen name="Stats"   component={StatsScreen}   options={{ tabBarLabel: 'สถิติ' }} />
      <MainTab.Screen name="Profile" options={{ tabBarLabel: 'โปรไฟล์' }}>
        {(props) => <ProfileScreen {...props} user={user} />}
      </MainTab.Screen>
    </MainTab.Navigator>
  );
}

function MainNavigator({ user }) {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Tabs">
        {(props) => <TabNavigator {...props} user={user} />}
      </MainStack.Screen>
      <MainStack.Screen name="ExerciseList"     component={ExerciseListScreen} />
      <MainStack.Screen name="VocabExercise"    component={VocabExerciseScreen} />
      <MainStack.Screen name="TenseExercise"    component={TenseExerciseScreen} />
      <MainStack.Screen name="ListeningExercise" component={ListeningExerciseScreen} />
      <MainStack.Screen name="VocabLibrary"     component={VocabLibraryScreen} />
    </MainStack.Navigator>
  );
}

export default function App() {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  // Native (iPhone/iPad/Android): ไม่จำกัด maxWidth เลย → เต็มจอเสมอ ไม่มีขอบขาวคั่น
  // Web: จำกัด 1100px เฉพาะจอกว้าง (>1024) เพื่อคงคอลัมน์กลางจอ + shadow ตอนเปิดบนเดสก์ท็อป
  const { width: winWidth } = useWindowDimensions();
  const appMaxWidth =
    Platform.OS === 'web' && winWidth > BREAKPOINTS.desktop
      ? CONTAINER_WIDTH.appDesktop
      : undefined;
  // style ช่วย: มีค่า maxWidth ค่อยใส่ (undefined = ไม่ cap = เต็มจอ)
  const appContainerStyle = appMaxWidth ? { maxWidth: appMaxWidth } : null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          const [profile, adminFlag] = await Promise.all([
            getUserProfile(currentUser.uid),
            checkIsAdmin(currentUser.email),
          ]);
          const mergedUser = {
            ...currentUser,
            username: profile?.username ?? currentUser.displayName ?? '',
            role: adminFlag ? 'admin' : 'user',
          };
          setUser(mergedUser);
        } else {
          setUser(null);
        }
      } catch (err) {
        // กัน callback ตายกลางทาง (เช่น ติดโควต้า Firebase) → เข้าใช้งานแบบ user ทั่วไปก่อน
        console.error('[App] onAuthStateChanged profile load failed:', err?.code, err?.message);
        setUser(currentUser
          ? { ...currentUser, username: currentUser.displayName ?? '', role: 'user' }
          : null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const isAdmin = user?.role === 'admin';

  if (loading) {
    return (
      <View style={[s.globalContainer, appContainerStyle]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
          <ActivityIndicator size="small" color={PRIMARY} />
        </View>
      </View>
    );
  }

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <View style={[s.globalContainer, appContainerStyle]}>
          <NavigationContainer>
            {user && isAdmin
              ? <AdminNavigator user={user} />
              : user
                ? <MainNavigator user={user} />
                : <AuthNavigator />
            }
          </NavigationContainer>
        </View>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const s = StyleSheet.create({
  globalContainer: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    marginHorizontal: 'auto',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
});
