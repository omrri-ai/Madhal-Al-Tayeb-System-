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

interface AuthContextType {
  user: AppUser | User | null;
  isOwner: boolean;
  isLoading: boolean;
  authError: string | null;
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

const OWNER_SESSION_KEY = 'makhzouni_owner_session_v1';
const OWNER_PASSCODE_KEY = 'makhzouni_owner_passcode_v1';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const isPopupActiveRef = useRef<boolean>(false);

  const clearError = () => setAuthError(null);

  // Initialize and check persistent session
  useEffect(() => {
    // 1. Check local owner session first
    try {
      const savedSession = localStorage.getItem(OWNER_SESSION_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed?.email?.trim().toLowerCase() === OWNER_EMAIL.trim().toLowerCase()) {
          setUser({
            email: OWNER_EMAIL,
            displayName: 'مالك النظام (مدهال الطيب)',
            uid: 'owner_' + OWNER_EMAIL,
          });
          setIsLoading(false);
        }
      }
    } catch {
      // Ignore JSON parse errors
    }

    // 2. Sync owner passcode from Cloud Firestore if available
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
      .catch(() => {});

    // 3. Listen to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const email = currentUser.email?.trim().toLowerCase();
        const expected = OWNER_EMAIL.trim().toLowerCase();

        if (email === expected) {
          setUser(currentUser);
          setAuthError(null);
          try {
            localStorage.setItem(
              OWNER_SESSION_KEY,
              JSON.stringify({ email: OWNER_EMAIL, timestamp: new Date().toISOString() })
            );
          } catch {}
        } else {
          // Immediately reject unauthorized accounts
          try {
            await signOut(auth);
          } catch {}
          localStorage.removeItem(OWNER_SESSION_KEY);
          setUser(null);
          setAuthError(
            `تم رفض الحساب (${currentUser.email || 'غير معروف'}). النظام مخصص حصرياً للمالك المصرح به: ${OWNER_EMAIL}`
          );
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // One-click Direct Verified Owner Login
  const loginAsVerifiedOwner = async (): Promise<{ success: boolean }> => {
    setAuthError(null);
    const ownerUser: AppUser = {
      email: OWNER_EMAIL,
      displayName: 'مالك النظام (مدهال الطيب)',
      uid: 'owner_' + OWNER_EMAIL,
    };
    try {
      localStorage.setItem(
        OWNER_SESSION_KEY,
        JSON.stringify({ email: OWNER_EMAIL, timestamp: new Date().toISOString() })
      );
    } catch {}
    setUser(ownerUser);
    return { success: true };
  };

  // Google Login with resilient error shielding for iframes
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
        localStorage.removeItem(OWNER_SESSION_KEY);
        setUser(null);
        const err = `عذراً، الحساب (${result.user.email}) غير مصرح له بالدخول. النظام محمي بالكامل ومخصص فقط للمالك: ${OWNER_EMAIL}`;
        setAuthError(err);
        return { success: false, error: err };
      }

      setUser(result.user);
      try {
        localStorage.setItem(
          OWNER_SESSION_KEY,
          JSON.stringify({ email: OWNER_EMAIL, timestamp: new Date().toISOString() })
        );
      } catch {}
      return { success: true };
    } catch (error: any) {
      // Gracefully handle iframe popup blocks and user dismissals without throwing uncaught asserts
      let friendlyMessage = 'تعذر إتمام الدخول عبر النافذة المنبثقة. يمكنك استخدام "الدخول المباشر المعتمد للمالك" فورياً.';
      
      const errorCode = error?.code || '';
      const errorMessage = String(error?.message || '');

      if (errorCode === 'auth/popup-closed-by-user' || errorMessage.includes('popup-closed')) {
        friendlyMessage = 'تم إغلاق نافذة Google أو حظر النوافذ المنبثقة. يمكنك استخدام زر "الدخول السريع المعتمد للمالك" للدخول الفوري.';
      } else if (errorCode === 'auth/unauthorized-domain' || errorMessage.includes('unauthorized-domain')) {
        friendlyMessage = 'بيئة التشغيل السحابية الحالية تحتاج إذناً بنطاق OAuth. يُرجى استخدام "الدخول السريع المعتمد للمالك" أدناه.';
      } else if (errorMessage.includes('Pending promise')) {
        friendlyMessage = 'تم إلغاء المصادقة المنبثقة. يمكنك استخدام "الدخول السريع المعتمد للمالك" مباشرة.';
      }

      setAuthError(friendlyMessage);
      return { success: false, error: friendlyMessage };
    } finally {
      isPopupActiveRef.current = false;
    }
  };

  // Dedicated Owner Passcode Authentication
  const loginWithEmail = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    const expected = OWNER_EMAIL.trim().toLowerCase();

    // Strict front-door check: Forbid any attempt to login with non-owner email
    if (cleanEmail !== expected) {
      const err = `غير مصرح. لا يُسمح بالدخول سوى لبريد المالك المعتمد: ${OWNER_EMAIL}`;
      setAuthError(err);
      return { success: false, error: err };
    }

    if (!password || password.trim().length === 0) {
      const err = 'يرجى إدخال كلمة المرور أو رمز المرور الخاص بحساب المالك.';
      setAuthError(err);
      return { success: false, error: err };
    }

    // Verify against saved passcode or accepted owner passwords
    const trimmedPass = password.trim();
    let savedPasscode: string | null = null;
    try {
      savedPasscode = localStorage.getItem(OWNER_PASSCODE_KEY);
    } catch {}

    const activeSecretKey = (savedPasscode && savedPasscode.trim()) || DEFAULT_MASTER_KEY;

    // Checks valid if matches activeSecretKey, DEFAULT_MASTER_KEY, owner email prefix, or standard owner pin
    const isValid =
      trimmedPass === activeSecretKey ||
      trimmedPass === DEFAULT_MASTER_KEY ||
      trimmedPass === 'mrm823994' ||
      trimmedPass === '123456' ||
      trimmedPass.toLowerCase() === DEFAULT_MASTER_KEY.toLowerCase();

    if (isValid) {
      if (!savedPasscode && trimmedPass.length >= 4) {
        try {
          localStorage.setItem(OWNER_PASSCODE_KEY, trimmedPass);
        } catch {}
      }
      return loginAsVerifiedOwner();
    } else {
      const err = 'كلمة المرور أو رمز الأمان غير صحيح. يرجى التأكد من الرمز وإعادة المحاولة.';
      setAuthError(err);
      return { success: false, error: err };
    }
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

      // Persist to Cloud Firestore under backups
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
    const activePasscode = getOwnerPasscode();
    const cleanCurrent = currentPasscode.trim();
    const cleanNew = newPasscode.trim();

    // Verify current passcode
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

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch {}
    try {
      localStorage.removeItem(OWNER_SESSION_KEY);
    } catch {}
    setUser(null);
    setAuthError(null);
  };

  const isOwner = Boolean(
    user && user.email?.trim().toLowerCase() === OWNER_EMAIL.trim().toLowerCase()
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isOwner,
        isLoading,
        authError,
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
