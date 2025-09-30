"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import type { UserProfile } from "@/types/firestore";
import { useAppContext } from "./app-context";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // We cannot use useAppContext here as AppProvider is a child of AuthProvider.
  // We will instead manage the app state via the user profile check.
  // The AppProvider will then consume this state.

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setUser(user);
        const userDocRef = doc(db, "users", user.uid);
        // Initial fetch to seed fast, then subscribe for live updates
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          } else {
            setUserProfile(null);
          }
        } catch {
          setUserProfile(null);
        }
        // Live subscription
        profileUnsub = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data() as UserProfile);
          }
        });
      } else {
        setUser(null);
        setUserProfile(null);
        if (profileUnsub) {
          profileUnsub();
          profileUnsub = null;
        }
      }
      setLoading(false);
    });

    return () => {
      if (profileUnsub) profileUnsub();
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const value = { user, userProfile, loading, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
