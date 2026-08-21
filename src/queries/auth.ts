import { supabase } from '../lib/supabase';
import { IUser, User } from '../models/User';
import { mockUsers } from '../models/mockAccounts';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignUpData {
  email: string;
  password: string;
  name: string;
}

/**
 * Check if the application is running in database-free mock mode
 */
const isMockMode = (): boolean => {
  return import.meta.env.VITE_USE_MOCK === 'true' || 
         !import.meta.env.VITE_SUPABASE_URL || 
         !import.meta.env.VITE_SUPABASE_ANON_KEY;
};

/**
 * Login query - signs in a user with email and password
 * Does not require email confirmation
 */
export async function loginQuery(credentials: LoginCredentials): Promise<IUser | null> {
  if (isMockMode()) {
    // 1. Check custom registered users first
    let registeredUsers: SignUpData[] = [];
    try {
      const data = localStorage.getItem('ipon_mock_registered_users');
      if (data) registeredUsers = JSON.parse(data);
    } catch (e) {
      console.error('Error reading mock users from localStorage:', e);
    }

    const matchedRegistered = registeredUsers.find(
      u => u.email === credentials.email && u.password === credentials.password
    );

    if (matchedRegistered) {
      const userData: IUser = {
        id: matchedRegistered.email,
        name: matchedRegistered.name,
        email: matchedRegistered.email,
        balance: 0,
        userId: matchedRegistered.email,
      };
      localStorage.setItem('ipon_mock_current_user', JSON.stringify(userData));
      return new User(userData);
    }

    // 2. Check default mock users
    const foundUser = mockUsers.find(
      u => u.email === credentials.email && u.password === credentials.password
    );

    if (foundUser) {
      const userData: IUser = {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        balance: 0,
        userId: foundUser.userId,
      };
      localStorage.setItem('ipon_mock_current_user', JSON.stringify(userData));
      return new User(userData);
    }

    return null;
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      console.error('Login error:', error);
      throw error;
    }

    if (!data.user) {
      return null;
    }

    // Fetch username from public.users table
    let username = data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User';
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('username')
        .eq('id', data.user.id)
        .single();
      if (profile && profile.username) {
        username = profile.username;
      }
    } catch (profileError) {
      console.warn('Error fetching profile from users table:', profileError);
    }

    const userData: IUser = {
      id: data.user.id,
      name: username,
      email: data.user.email || credentials.email,
      balance: data.user.user_metadata?.balance || 0,
      userId: data.user.id,
    };

    return new User(userData);
  } catch (error) {
    console.error('Login exception:', error);
    throw error;
  }
}

/**
 * Sign up query - creates a new user account
 */
export interface SignUpResult {
  user: IUser;
  sessionCreated: boolean;
}

/**
 * Sign up query - creates a new user account
 */
export async function signUpQuery(userData: SignUpData): Promise<SignUpResult | null> {
  if (isMockMode()) {
    let registeredUsers: SignUpData[] = [];
    try {
      const data = localStorage.getItem('ipon_mock_registered_users');
      if (data) registeredUsers = JSON.parse(data);
    } catch (e) {}

    // Avoid duplicate sign ups
    if (registeredUsers.some(u => u.email === userData.email)) {
      return null;
    }

    registeredUsers.push(userData);
    localStorage.setItem('ipon_mock_registered_users', JSON.stringify(registeredUsers));

    const newUser: IUser = {
      id: userData.email,
      name: userData.name,
      email: userData.email,
      balance: 0,
      userId: userData.email,
    };
    localStorage.setItem('ipon_mock_current_user', JSON.stringify(newUser));
    return {
      user: new User(newUser),
      sessionCreated: true
    };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          name: userData.name,
          balance: 0,
        },
        // Disable email confirmation
        emailRedirectTo: undefined,
      },
    });

    if (error) {
      console.error('Sign up error:', error);
      throw error;
    }

    if (!data.user) {
      return null;
    }

    const newUser: IUser = {
      id: data.user.id,
      name: userData.name,
      email: userData.email,
      balance: 0,
      userId: data.user.id,
    };

    return {
      user: new User(newUser),
      sessionCreated: !!data.session
    };
  } catch (error) {
    console.error('Sign up exception:', error);
    throw error;
  }
}

/**
 * Logout query - signs out the current user
 */
export async function logoutQuery(): Promise<void> {
  if (isMockMode()) {
    localStorage.removeItem('ipon_mock_current_user');
    return;
  }

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Logout exception:', error);
    throw error;
  }
}

/**
 * Get current session query - retrieves the current authenticated user
 */
export async function getCurrentUserQuery(): Promise<IUser | null> {
  if (isMockMode()) {
    try {
      const data = localStorage.getItem('ipon_mock_current_user');
      if (data) {
        const userData: IUser = JSON.parse(data);
        return new User(userData);
      }
    } catch (e) {}
    return null;
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session || !session.user) {
      return null;
    }

    // Fetch username from public.users table
    let username = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User';
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('username')
        .eq('id', session.user.id)
        .single();
      if (profile && profile.username) {
        username = profile.username;
      }
    } catch (profileError) {
      console.warn('Error fetching profile from users table:', profileError);
    }

    const userData: IUser = {
      id: session.user.id,
      name: username,
      email: session.user.email || '',
      balance: session.user.user_metadata?.balance || 0,
      userId: session.user.id,
    };

    return new User(userData);

  } catch (error) {
    console.error('Get current user exception:', error);
    return null;
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (user: IUser | null) => void) {
  if (isMockMode()) {
    return {
      data: {
        subscription: {
          unsubscribe: () => {}
        }
      }
    };
  }

  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const userData: IUser = {
        id: session.user.id,
        name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
        email: session.user.email || '',
        balance: session.user.user_metadata?.balance || 0,
        userId: session.user.id,
      };
      callback(new User(userData));
    } else {
      callback(null);
    }
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmailQuery(email: string): Promise<boolean> {
  if (isMockMode()) {
    let registeredUsers: SignUpData[] = [];
    try {
      const data = localStorage.getItem('ipon_mock_registered_users');
      if (data) registeredUsers = JSON.parse(data);
    } catch (e) {}

    const userExists = registeredUsers.some(u => u.email === email) || mockUsers.some(u => u.email === email);
    if (!userExists) {
      throw new Error("No user registered with this email address.");
    }
    return true;
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      console.error('Password reset email error:', error);
      throw error;
    }
    return true;
  } catch (error) {
    console.error('sendPasswordResetEmailQuery exception:', error);
    throw error;
  }
}

/**
 * Update current user's password
 */
export async function updatePasswordQuery(newPassword: string): Promise<boolean> {
  if (isMockMode()) {
    const data = localStorage.getItem('ipon_mock_current_user');
    if (data) {
      const currentUser = JSON.parse(data);
      let registeredUsers: SignUpData[] = [];
      try {
        const regData = localStorage.getItem('ipon_mock_registered_users');
        if (regData) registeredUsers = JSON.parse(regData);
      } catch (e) {}

      const userIndex = registeredUsers.findIndex(u => u.email === currentUser.email);
      if (userIndex !== -1) {
        registeredUsers[userIndex].password = newPassword;
        localStorage.setItem('ipon_mock_registered_users', JSON.stringify(registeredUsers));
      }
    }
    return true;
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error('Update password error:', error);
      throw error;
    }
    return true;
  } catch (error) {
    console.error('updatePasswordQuery exception:', error);
    throw error;
  }
}

