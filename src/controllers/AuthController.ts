import { IUser } from "../models/User";
import { loginQuery, logoutQuery, getCurrentUserQuery, signUpQuery, SignUpData, SignUpResult } from "../queries/auth";

export class AuthController {
  /**
   * Login using Supabase authentication
   */
  async login(data: { email: string; password: string }): Promise<IUser | null> {
    return await loginQuery(data);
  }

  /**
   * Sign up a new user using Supabase authentication
   */
  async signUp(data: SignUpData): Promise<SignUpResult | null> {
    return await signUpQuery(data);
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    return await logoutQuery();
  }

  /**
   * Get the current authenticated user
   */
  async getCurrentUser(): Promise<IUser | null> {
    return await getCurrentUserQuery();
  }
}
