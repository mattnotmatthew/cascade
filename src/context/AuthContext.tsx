// Authentication context for managing user state across the app

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  type AuthUser,
  type AuthResult,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOut as authSignOut,
  getCurrentUser,
  onAuthStateChange,
  updateDisplayName,
  getUserProfile,
} from "../services/authService";
import { isSupabaseEnabled } from "../services/supabase";

interface AuthContextValue {
  // State
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isEmailConfirmed: boolean;
  isSupabaseAvailable: boolean;
  profileDisplayName: string | null;
  needsDisplayName: boolean;

  // Actions
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<{ error: string | null }>;
  setDisplayName: (name: string) => Promise<{ success: boolean; error: string | null }>;

  // UI control
  showAuthModal: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  showDisplayNameModal: boolean;
  openDisplayNameModal: () => void;
  closeDisplayNameModal: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDisplayNameModal, setShowDisplayNameModal] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);

  const isSupabaseAvailable = isSupabaseEnabled();
  const isAuthenticated = user !== null;
  const isEmailConfirmed = user?.emailConfirmed ?? false;

  // User needs to set display name if: confirmed, authenticated, and still has default "Player" name
  const needsDisplayName = isAuthenticated && isEmailConfirmed && profileDisplayName === "Player";

  // Load profile when user changes
  useEffect(() => {
    async function loadProfile() {
      if (user && isEmailConfirmed) {
        const profile = await getUserProfile();
        if (profile) {
          setProfileDisplayName(profile.displayName);
          // Auto-show display name modal if they have default name
          if (profile.displayName === "Player") {
            setShowDisplayNameModal(true);
          }
        }
      } else {
        setProfileDisplayName(null);
      }
    }
    loadProfile();
  }, [user, isEmailConfirmed]);

  // Initialize auth state
  useEffect(() => {
    if (!isSupabaseAvailable) {
      setIsLoading(false);
      return;
    }

    // Get initial user
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    // Subscribe to auth changes
    const unsubscribe = onAuthStateChange((newUser) => {
      setUser(newUser);
    });

    return unsubscribe;
  }, [isSupabaseAvailable]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await signInWithEmail(email, password);
    if (result.user) {
      setUser(result.user);
      setShowAuthModal(false);
    }
    return result;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await signUpWithEmail(email, password);
    if (result.user) {
      setUser(result.user);
      setShowAuthModal(false);
    }
    return result;
  }, []);

  const signInGoogle = useCallback(async () => {
    const result = await signInWithGoogle();
    // Google OAuth redirects, so modal will close on return
    return result;
  }, []);

  const signOut = useCallback(async () => {
    const result = await authSignOut();
    if (!result.error) {
      setUser(null);
      setProfileDisplayName(null);
    }
    return result;
  }, []);

  const setDisplayName = useCallback(async (name: string) => {
    const result = await updateDisplayName(name);
    if (result.success) {
      setProfileDisplayName(name);
      setShowDisplayNameModal(false);
    }
    return result;
  }, []);

  const openAuthModal = useCallback(() => {
    setShowAuthModal(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setShowAuthModal(false);
  }, []);

  const openDisplayNameModal = useCallback(() => {
    setShowDisplayNameModal(true);
  }, []);

  const closeDisplayNameModal = useCallback(() => {
    setShowDisplayNameModal(false);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated,
    isEmailConfirmed,
    isSupabaseAvailable,
    profileDisplayName,
    needsDisplayName,
    signIn,
    signUp,
    signInGoogle,
    signOut,
    setDisplayName,
    showAuthModal,
    openAuthModal,
    closeAuthModal,
    showDisplayNameModal,
    openDisplayNameModal,
    closeDisplayNameModal,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Export a convenience hook for checking if user can save scores
export function useCanSaveScores(): boolean {
  const { isAuthenticated, isEmailConfirmed, isSupabaseAvailable } = useAuth();
  return isAuthenticated && isEmailConfirmed && isSupabaseAvailable;
}
