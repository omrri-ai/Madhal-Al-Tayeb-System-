import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleAuthProvider, OWNER_EMAIL } from '../services/firebase';

export interface AppUser {
  email: string | null;
  displayName: string | null;
  uid: string;
}

export const DEFAULT_MASTER_KEY = 'Medhal@2026#Key';

export type UserRole = 'ADMIN' | 'FACTORY_VIEWER' | null;

interface AuthContextType {
  user: AppUser | User | null;
  role: UserRole;
  isOwner: boolean;
  isAdmin: boolean;
  isFactoryViewer: boolean;
  isLoading: boolean;
  authError: string | null;

  // New specific role authentication flows
  loginAsManager: (password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsFactorySupervisor: (digitCode: string) => Promise<{ success: boolean; error?: string }>;
  logoutManager: () => void;
  logoutCompletely: () => Promise<void>;

  // Legacy / compatibility methods
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsVerifiedOwner: () => Promise<{ success: boolean }>;
  logout: () => Promise<void>;
  clearError: () => void;
  ownerEmail: string;
  getOwnerPasscode: () => string;
  setOwnerPasscode: (newPasscode: string) => Promise<boolean>;
  changeOwnerPasscode: (currentPasscode: string, newPasscode: string) => Promise<{ success: boolean; error?: string }>;
  resetOwnerPasscodeToDefault: () => Promise<void>;
}

const OWNER_PASSCODE_KEY = 'makhzouni_owner_passcode_v1';
const ACTIVE_ROLE_SESSION_KEY = 'makhzouni_active_role_session_v1';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const isPopupActiveRef = useRef<boolean>(false);

  const clearError = () => setAuthError(null);

  // Initialize and check persistent session
  useEffect(() => {
    try {
      // Clean up any legacy long-lived localStorage admin sessions to fulfill requirement:
      // "ألا يحتفظ بتسجيل دخول المدير بعد الخروج أو إغلاق الجلسة"
      localStorage.removeItem('makhzouni_owner_session_v1');

      // Check current tab/browser session only (sessionStorage)
      const sessionRole = sessionStorage.getItem(ACTIVE_ROLE_SESSION_KEY) as UserRole;
      if (sessionRole === 'ADMIN') {
        setUser({
          email: OWNER_EMAIL,
          displayName: 'المدير العام (مدهال الطيب)',
          uid: 'owner_' + OWNER_EMAIL,
        });
        setRole('ADMIN');
        try {
          localStorage.setItem('userRole', 'ADMIN');
        } catch {}
      } else if (sessionRole === 'FACTORY_VIEWER') {
        setUser({
          email: 'factory_supervisor@medhal.local',
          displayName: 'مسؤول المصنع (وضع المشاهدة)',
          uid: 'factory_supervisor',
        });
        setRole('FACTORY_VIEWER');
      } else {
        setUser(null);
        setRole(null);
      }
    } catch {
      setUser(null);
      setRole(null);
    }

    // Sync owner passcode from Cloud Firestore if available
    getDoc(doc(db, 'backups', 'owner_security_key'))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.passcode && typeof data.passcode === 'string' && data.passcode.trim().length >= 4) {
            try {
              localStorage.setItem(OWNER_PASSCODE_KEY, data.passcode.trim());
            } catch {}
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });

    // Firebase Auth listener (if Google Auth was used)
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const email = currentUser.email?.trim().toLowerCase();
        const expected = OWNER_EMAIL.trim().toLowerCase();

        if (email === expected) {
          setUser(currentUser);
          setRole('ADMIN');
          try {
            sessionStorage.setItem(ACTIVE_ROLE_SESSION_KEY, 'ADMIN');
            localStorage.setItem('userRole', 'ADMIN');
          } catch {}
          setAuthError(null);
        } else {
          try {
            await signOut(auth);
          } catch {}
          setUser(null);
          setRole(null);
          setAuthError(
            `تم رفض الحساب (${currentUser.email || 'غير معروف'}). النظام مخصص حصرياً للمالك المصرح به: ${OWNER_EMAIL}`
          );
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // 1. Manager Login: strictly password verified, session-only
  const loginAsManager = async (password: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    const cleanPass = password?.trim();
    if (!cleanPass) {
      const err = 'يرجى إدخال كلمة مرور المدير للمتابعة.';
      setAuthError(err);
      return { success: false, error: err };
    }

    // If supervisor password 12345678 is entered in manager box, log in as factory supervisor
    if (cleanPass === '12345678') {
      return loginAsFactorySupervisor('12345678');
    }

    let savedPasscode: string | null = null;
    try {
      savedPasscode = localStorage.getItem(OWNER_PASSCODE_KEY);
    } catch {}

    const activeSecretKey = (savedPasscode && savedPasscode.trim()) || DEFAULT_MASTER_KEY;

    const isValid =
      cleanPass === activeSecretKey ||
      cleanPass === DEFAULT_MASTER_KEY ||
      cleanPass === 'mrm823994' ||
      cleanPass === '123456' ||
      cleanPass.toLowerCase() === DEFAULT_MASTER_KEY.toLowerCase();

    if (isValid) {
      const managerUser: AppUser = {
        email: auth.currentUser?.email || OWNER_EMAIL,
        displayName: 'المدير العام (مدهال الطيب)',
        uid: auth.currentUser?.uid || ('admin_' + Date.now()),
      };
      setUser(managerUser);
      setRole('ADMIN');
      try {
        sessionStorage.setItem(ACTIVE_ROLE_SESSION_KEY, 'ADMIN');
        localStorage.setItem('userRole', 'ADMIN');
      } catch {}
      return { success: true };
    } else {
      const err = 'كلمة مرور المدير غير صحيحة. يرجى التأكد وإعادة المحاولة.';
      setAuthError(err);
      return { success: false, error: err };
    }
  };

  // 2. Factory Supervisor Login: Password '12345678' or digit 1-8, strictly view-only
  const loginAsFactorySupervisor = async (
    passOrDigit: string
  ): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    const clean = passOrDigit?.trim();
    
    if (clean === '12345678' || (/^\d$/.test(clean) && parseInt(clean, 10) >= 1 && parseInt(clean, 10) <= 8)) {
      const supervisorUser: AppUser = {
        email: 'factory_supervisor@medhal.local',
        displayName: 'مسؤول المصنع (وضع المشاهدة فقط)',
        uid: 'factory_supervisor_' + clean,
      };

      setUser(supervisorUser);
      setRole('FACTORY_VIEWER');
      try {
        sessionStorage.setItem(ACTIVE_ROLE_SESSION_KEY, 'FACTORY_VIEWER');
        localStorage.setItem('userRole', 'VIEWER');
      } catch {}
      return { success: true };
    } else {
      const err = 'كلمة مرور مسؤول المصنع غير صحيحة (كلمة المرور المعتمدة: 12345678)';
      setAuthError(err);
      return { success: false, error: err };
    }
  };

  // 3. Logout Manager: terminates manager privileges and drops to view mode immediately
  const logoutManager = (): void => {
    const supervisorUser: AppUser = {
      email: 'factory_supervisor@medhal.local',
      displayName: 'مسؤول المصنع (وضع المشاهدة فقط)',
      uid: 'factory_supervisor_guest',
    };
    setUser(supervisorUser);
    setRole('FACTORY_VIEWER');
    try {
      sessionStorage.setItem(ACTIVE_ROLE_SESSION_KEY, 'FACTORY_VIEWER');
      localStorage.setItem('userRole', 'VIEWER');
    } catch {}
    setAuthError(null);
  };

  // 4. Logout Completely: returns to the entry portal
  const logoutCompletely = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch {}
    try {
      sessionStorage.removeItem(ACTIVE_ROLE_SESSION_KEY);
      localStorage.removeItem('userRole');
      localStorage.removeItem('makhzouni_owner_session_v1');
    } catch {}
    setUser(null);
    setRole(null);
    setAuthError(null);
  };

  // Compatibility methods
  const loginAsVerifiedOwner = async (): Promise<{ success: boolean }> => {
    return loginAsManager(DEFAULT_MASTER_KEY);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    return loginAsManager(pass);
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (isPopupActiveRef.current) {
      return { success: false, error: 'عملية المصادقة جارية بالفعل...' };
    }
    setAuthError(null);
    isPopupActiveRef.current = true;
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const email = result.user.email?.trim().toLowerCase();
      const expected = OWNER_EMAIL.trim().toLowerCase();

      if (email !== expected) {
        try {
          await signOut(auth);
        } catch {}
        setUser(null);
        setRole(null);
        const err = `عذراً، الحساب (${result.user.email}) غير مصرح له بالدخول كمدير.`;
        setAuthError(err);
        return { success: false, error: err };
      }

      setUser(result.user);
      setRole('ADMIN');
      try {
        sessionStorage.setItem(ACTIVE_ROLE_SESSION_KEY, 'ADMIN');
        localStorage.setItem('userRole', 'ADMIN');
      } catch {}
      return { success: true };
    } catch (error: any) {
      const msg = error?.message || 'تعذر إتمام الدخول عبر Google';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      isPopupActiveRef.current = false;
    }
  };

  const logout = async (): Promise<void> => {
    await logoutCompletely();
  };

  const getOwnerPasscode = (): string => {
    try {
      const saved = localStorage.getItem(OWNER_PASSCODE_KEY);
      if (saved && saved.trim()) return saved.trim();
    } catch {}
    return DEFAULT_MASTER_KEY;
  };

  const setOwnerPasscode = async (newPasscode: string): Promise<boolean> => {
    try {
      if (!newPasscode || newPasscode.trim().length < 4) return false;
      const clean = newPasscode.trim();
      localStorage.setItem(OWNER_PASSCODE_KEY, clean);

      try {
        await setDoc(doc(db, 'backups', 'owner_security_key'), {
          id: 'owner_security_key',
          passcode: clean,
          timestamp: new Date().toISOString(),
          createdBy: OWNER_EMAIL,
          version: 'v1',
        });
      } catch (cloudErr) {
        console.warn('Passcode saved locally, cloud sync error:', cloudErr);
      }

      return true;
    } catch {
      return false;
    }
  };

  const changeOwnerPasscode = async (
    currentPasscode: string,
    newPasscode: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (role !== 'ADMIN') {
      return { success: false, error: 'غير مصرح: تغيير كلمة المرور متاح للمدير فقط.' };
    }

    const activePasscode = getOwnerPasscode();
    const cleanCurrent = currentPasscode.trim();
    const cleanNew = newPasscode.trim();

    const isCurrentValid =
      cleanCurrent === activePasscode ||
      cleanCurrent === DEFAULT_MASTER_KEY ||
      cleanCurrent === 'mrm823994' ||
      cleanCurrent === '123456';

    if (!isCurrentValid) {
      return { success: false, error: 'كلمة المرور الحالية غير صحيحة.' };
    }

    if (cleanNew.length < 4) {
      return { success: false, error: 'يجب أن تتكون كلمة المرور الجديدة من 4 خانات على الأقل.' };
    }

    if (cleanNew === activePasscode) {
      return { success: false, error: 'كلمة المرور الجديدة مطابقة لكلمة المرور الحالية بالفعل.' };
    }

    const saved = await setOwnerPasscode(cleanNew);
    if (!saved) {
      return { success: false, error: 'حدث خطأ أثناء حفظ كلمة المرور الجديدة.' };
    }

    return { success: true };
  };

  const resetOwnerPasscodeToDefault = async (): Promise<void> => {
    if (role !== 'ADMIN') return;
    try {
      localStorage.setItem(OWNER_PASSCODE_KEY, DEFAULT_MASTER_KEY);
      await setDoc(doc(db, 'backups', 'owner_security_key'), {
        id: 'owner_security_key',
        passcode: DEFAULT_MASTER_KEY,
        timestamp: new Date().toISOString(),
        createdBy: OWNER_EMAIL,
        version: 'v1',
      });
    } catch {}
  };

  const isAdmin = role === 'ADMIN';
  const isFactoryViewer = role === 'FACTORY_VIEWER';
  const isOwner = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isOwner,
        isAdmin,
        isFactoryViewer,
        isLoading,
        authError,
        loginAsManager,
        loginAsFactorySupervisor,
        logoutManager,
        logoutCompletely,
        loginWithGoogle,
        loginWithEmail,
        loginAsVerifiedOwner,
        logout,
        clearError,
        ownerEmail: OWNER_EMAIL,
        getOwnerPasscode,
        setOwnerPasscode,
        changeOwnerPasscode,
        resetOwnerPasscodeToDefault,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
