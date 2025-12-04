import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { signUpWithEmail, signInWithGoogle } from './auth';
import WhagonsTitle from '@/assets/WhagonsTitle';
import { api, updateAuthToken, setSubdomain } from '@/api/whagonsApi';
import { auth } from '@/firebase/firebaseConfig';
import { signOut } from 'firebase/auth';

const InvitationSignUp: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [validating, setValidating] = useState<boolean>(true);
  const [invitationValid, setInvitationValid] = useState<boolean>(false);


  // Helper function to extract tenant from URL and set subdomain
  // Only sets tenant if there's a valid subdomain (not plain localhost)
  const extractAndSetTenant = () => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // Only set tenant if we have a valid subdomain pattern
    // e.g., "test1.localhost" or "test1.example.com" -> "test1"
    // Skip if it's just "localhost" or "www.example.com"
    if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== 'www' && parts[0] !== '127') {
      const tenantPrefix = parts[0];
      // Only set tenant subdomain on invitation screen
      setSubdomain(tenantPrefix);
      console.log('Invitation screen: Extracted tenant from URL:', tenantPrefix);
      return tenantPrefix;
    }
    
    // If no valid tenant found, don't set anything (will use default/empty subdomain)
    console.warn('No valid tenant subdomain found in URL:', hostname);
    return null;
  };

  // Validate invitation token on mount and clear any existing Firebase session
  useEffect(() => {
    const validateInvitation = async () => {
      if (!token) {
        setError('Invalid invitation link');
        setValidating(false);
        return;
      }

      // Clear any existing Firebase session when entering invitation page
      // Invitations are for new signups, so we should start fresh
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          console.log('Clearing existing Firebase session for invitation signup');
          await signOut(auth);
        }
      } catch (err) {
        console.warn('Failed to sign out existing session:', err);
        // Continue anyway - not critical
      }

      // Extract and set tenant from URL before making API call
      // This ensures API requests go to the correct tenant subdomain
      const tenantPrefix = extractAndSetTenant();
      
      if (!tenantPrefix) {
        setError('Invalid invitation link: No tenant subdomain found in URL');
        setValidating(false);
        return;
      }

      try {
        const response = await api.get(`/invitations/validate/${token}`);
        if (response.status === 200 && response.data.data) {
          setInvitationValid(true);
          // Tenant domain is already set from URL extraction above
        } else {
          setError('Invalid or expired invitation');
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Invalid or expired invitation');
      } finally {
        setValidating(false);
      }
    };

    validateInvitation();
  }, [token]);

  async function checkPassword() {
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return false;
    }
    const regex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/;
    if (!regex.test(password)) {
      alert(
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number',
      );
      return false;
    }
    return true;
  }

  async function invitationSignup(idToken: string) {
    try {
      setLoading(true);
      setError('');

      // Ensure tenant subdomain is set before making API call
      // This is critical - the API needs to know which tenant database to use
      const tenantPrefix = extractAndSetTenant();
      if (!tenantPrefix) {
        setError('Invalid invitation link: No tenant subdomain found in URL');
        setLoading(false);
        return false;
      }

      console.log('Invitation signup: Using tenant subdomain:', tenantPrefix);

      const response = await api.post(`/invitations/signup/${token}`, {
        token: idToken
      });

      console.log('Invitation signup response:', {
        status: response.status,
        data: response.data,
        hasToken: !!response.data?.data?.token,
        hasUser: !!response.data?.data?.user
      });

      if (response.status === 200 && response.data?.data?.token) {
        console.log('Successfully signed up via invitation, updating auth token');
        updateAuthToken(response.data.data.token);
        
        // Use the user data from the signup response directly
        // This avoids the AuthProvider skip logic that blocks /me requests on invitation pages
        const userData = response.data.data.user;
        console.log('User data from signup response:', userData);
        
        // Force immediate redirect - don't wait for AuthProvider
        // The user data is already in the response, so we can navigate immediately
        console.log('Navigating to home page immediately...');
        
        // Use window.location to force a full page reload and clear the invitation page context
        // This ensures PublicRoute doesn't block us and AuthProvider can fetch user data properly
        window.location.href = '/';
        
        return true;
      } else {
        console.error('Invalid response structure:', response);
        setError('Signup failed. Invalid response from server.');
        return false;
      }
    } catch (err: any) {
      console.error('Invitation signup error:', err);
      console.error('Error response:', err?.response);
      const errorMessage = err?.response?.data?.message || err?.message || 'Signup failed. Please try again.';
      setError(errorMessage);
      setLoading(false);
      return false;
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleSignUp = async () => {
    try {
      const userCredential = await signInWithGoogle();
      const user = userCredential.user;
      const idToken = await user.getIdToken();
      const success = await invitationSignup(idToken);
      if (!success) {
        // Only show error if invitation signup API call failed
        // Firebase login succeeded, so don't show "login failed"
        setError('Failed to complete signup. Please try again.');
      }
      // If success, invitationSignup already handles navigation
    } catch (error: any) {
      console.error('Google signup error:', error);
      // Only show error if Firebase login itself failed
      if (error?.code?.startsWith('auth/')) {
        setError('Google signup failed: ' + (error.message || 'Please try again.'));
      } else {
        setError('Signup failed. Please try again.');
      }
    }
  };

  const handleEmailSignUp = async () => {
    try {
      if (!(await checkPassword())) {
        return;
      }
      
      // For email signup, we need to create Firebase account first
      // Then use the Firebase token for invitation signup
      const userCredential = await signUpWithEmail(email, password);
      const user = userCredential.user;
      const idToken = await user.getIdToken();
      const success = await invitationSignup(idToken);
      
      if (!success) {
        alert('Signup failed. Please try again.');
      }
    } catch (error: any) {
      setError('Email sign-up failed: ' + (error as Error).message);
    }
  };

  if (validating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 bg-background">
        <div className="text-center">
          <div className="mb-4">Validating invitation...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!invitationValid) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 bg-background">
        <div className="rounded-lg border border-border bg-card shadow-lg dark:shadow-xl max-w-md w-full p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Invalid Invitation</h2>
          <p className="text-muted-foreground mb-6">{error || 'This invitation link is invalid or has expired.'}</p>
          <Link to="/auth/signin" className="text-primary hover:text-primary/80 font-medium">
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 bg-background">
      <div className="rounded-lg border border-border bg-card shadow-lg dark:shadow-xl max-w-6xl w-full">
        <div className="flex flex-wrap items-center">
          <div className="hidden w-full xl:block xl:w-1/2">
            <div className="py-16 px-12 text-center">
              <Link className="mb-8 inline-block" to="/">
                <WhagonsTitle />
              </Link>
              <p className="text-muted-foreground 2xl:px-20">
                You've been invited to join a team on Whagons. Create your account to get started.
              </p>
            </div>
          </div>

          <div className="w-full border-l border-border xl:w-1/2">
            <div className="w-full p-8 sm:p-12 xl:p-16">
              <span className="mb-2 block font-medium text-muted-foreground">Join your team</span>
              <h2 className="mb-9 text-2xl font-bold text-foreground sm:text-3xl">
                Sign Up to Whagons
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label className="mb-2.5 block font-medium text-foreground">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full rounded-lg border border-input bg-background py-4 pl-6 pr-10 text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-colors"
                  />
                  <span className="absolute right-4 top-4 text-muted-foreground">
                    <svg
                      className="fill-current"
                      width="22"
                      height="22"
                      viewBox="0 0 22 22"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g opacity="0.5">
                        <path
                          d="M19.2516 3.30005H2.75156C1.58281 3.30005 0.585938 4.26255 0.585938 5.46567V16.6032C0.585938 17.7719 1.54844 18.7688 2.75156 18.7688H19.2516C20.4203 18.7688 21.4172 17.8063 21.4172 16.6032V5.4313C21.4172 4.26255 20.4203 3.30005 19.2516 3.30005ZM19.2516 4.84692C19.2859 4.84692 19.3203 4.84692 19.3547 4.84692L11.0016 10.2094L2.64844 4.84692C2.68281 4.84692 2.71719 4.84692 2.75156 4.84692H19.2516ZM19.2516 17.1532H2.75156C2.40781 17.1532 2.13281 16.8782 2.13281 16.5344V6.35942L10.1766 11.5157C10.4172 11.6875 10.6922 11.7563 10.9672 11.7563C11.2422 11.7563 11.5172 11.6875 11.7578 11.5157L19.8016 6.35942V16.5688C19.8703 16.9125 19.5953 17.1532 19.2516 17.1532Z"
                          fill=""
                        />
                      </g>
                    </svg>
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-2.5 block font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-input bg-background py-4 pl-6 pr-10 text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-colors"
                  />
                  <span className="absolute right-4 top-4 text-muted-foreground">
                    <svg
                      className="fill-current"
                      width="22"
                      height="22"
                      viewBox="0 0 22 22"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g opacity="0.5">
                        <path
                          d="M16.1547 6.80626V5.91251C16.1547 3.16251 14.0922 0.825009 11.4797 0.618759C10.0359 0.481259 8.59219 0.996884 7.52656 1.95938C6.46094 2.92188 5.84219 4.29688 5.84219 5.70626V6.80626C3.84844 7.18438 2.33594 8.93751 2.33594 11.0688V17.2906C2.33594 19.5594 4.19219 21.3813 6.42656 21.3813H15.5016C17.7703 21.3813 19.6266 19.525 19.6266 17.2563V11C19.6609 8.93751 18.1484 7.21876 16.1547 6.80626ZM8.55781 3.09376C9.31406 2.40626 10.3109 2.06251 11.3422 2.16563C13.1641 2.33751 14.6078 3.98751 14.6078 5.91251V6.70313H7.38906V5.67188C7.38906 4.70938 7.80156 3.78126 8.55781 3.09376ZM18.1141 17.2906C18.1141 18.7 16.9453 19.8688 15.5359 19.8688H6.46094C5.05156 19.8688 3.91719 18.7344 3.91719 17.325V11.0688C3.91719 9.52189 5.15469 8.28438 6.70156 8.28438H15.2953C16.8422 8.28438 18.1141 9.52188 18.1141 11V17.2906Z"
                          fill=""
                        />
                        <path
                          d="M10.9977 11.8594C10.5852 11.8594 10.207 12.2031 10.207 12.65V16.2594C10.207 16.6719 10.5508 17.05 10.9977 17.05C11.4102 17.05 11.7883 16.7063 11.7883 16.2594V12.6156C11.7883 12.2031 11.4102 11.8594 10.9977 11.8594Z"
                          fill=""
                        />
                      </g>
                    </svg>
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <label className="mb-2.5 block font-medium text-foreground">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full rounded-lg border border-input bg-background py-4 pl-6 pr-10 text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-colors"
                  />
                  <span className="absolute right-4 top-4 text-muted-foreground">
                    <svg
                      className="fill-current"
                      width="22"
                      height="22"
                      viewBox="0 0 22 22"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g opacity="0.5">
                        <path
                          d="M16.1547 6.80626V5.91251C16.1547 3.16251 14.0922 0.825009 11.4797 0.618759C10.0359 0.481259 8.59219 0.996884 7.52656 1.95938C6.46094 2.92188 5.84219 4.29688 5.84219 5.70626V6.80626C3.84844 7.18438 2.33594 8.93751 2.33594 11.0688V17.2906C2.33594 19.5594 4.19219 21.3813 6.42656 21.3813H15.5016C17.7703 21.3813 19.6266 19.525 19.6266 17.2563V11C19.6609 8.93751 18.1484 7.21876 16.1547 6.80626ZM8.55781 3.09376C9.31406 2.40626 10.3109 2.06251 11.3422 2.16563C13.1641 2.33751 14.6078 3.98751 14.6078 5.91251V6.70313H7.38906V5.67188C7.38906 4.70938 7.80156 3.78126 8.55781 3.09376ZM18.1141 17.2906C18.1141 18.7 16.9453 19.8688 15.5359 19.8688H6.46094C5.05156 19.8688 3.91719 18.7344 3.91719 17.325V11.0688C3.91719 9.52189 5.15469 8.28438 6.70156 8.28438H15.2953C16.8422 8.28438 18.1141 9.52188 18.1141 11V17.2906Z"
                          fill=""
                        />
                        <path
                          d="M10.9977 11.8594C10.5852 11.8594 10.207 12.2031 10.207 12.65V16.2594C10.207 16.6719 10.5508 17.05 10.9977 17.05C11.4102 17.05 11.7883 16.7063 11.7883 16.2594V12.6156C11.7883 12.2031 11.4102 11.8594 10.9977 11.8594Z"
                          fill=""
                        />
                      </g>
                    </svg>
                  </span>
                </div>
              </div>

              <div className="mb-5">
                <button
                  onClick={handleEmailSignUp}
                  disabled={loading}
                  className="w-full cursor-pointer rounded-lg border border-primary bg-primary py-4 px-4 text-primary-foreground font-medium transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
              </div>

              <button
                className="flex w-full items-center justify-center gap-3.5 rounded-lg border border-border bg-secondary py-4 px-4 text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleGoogleSignUp}
                disabled={loading}
              >
                <span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g clipPath="url(#clip0_191_13499)">
                      <path
                        d="M19.999 10.2217C20.0111 9.53428 19.9387 8.84788 19.7834 8.17737H10.2031V11.8884H15.8266C15.7201 12.5391 15.4804 13.162 15.1219 13.7195C14.7634 14.2771 14.2935 14.7578 14.5685 14.7578L14.5489 14.8821L17.5782 17.1818L17.7882 17.2024C19.7155 15.4579 20.8268 13.0307 20.8268 10.2217"
                        fill="#4285F4"
                      />
                      <path
                        d="M10.2055 19.9999C12.9605 19.9999 15.2734 19.111 16.9629 17.5777L13.7429 15.1331C12.8813 15.7221 11.7248 16.1333 10.2055 16.1333C8.91513 16.1259 7.65991 15.7205 6.61791 14.9745C5.57592 14.2286 4.80007 13.1801 4.40044 11.9777L4.28085 11.9877L1.13101 14.3765L1.08984 14.4887C1.93817 16.1456 3.24007 17.5386 4.84997 18.5118C6.45987 19.4851 8.31429 20.0004 10.2059 19.9999"
                        fill="#34A853"
                      />
                      <path
                        d="M4.39899 11.9777C4.1758 11.3411 4.06063 10.673 4.05807 9.99996C4.06218 9.32799 4.1731 8.66075 4.38684 8.02225L4.38115 7.88968L1.19269 5.4624L1.0884 5.51101C0.372763 6.90343 0 8.4408 0 9.99987C0 11.5589 0.372763 13.0963 1.0884 14.4887L4.39899 11.9777Z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M10.2059 3.86663C11.668 3.84438 13.0822 4.37803 14.1515 5.35558L17.0313 2.59996C15.1843 0.901848 12.7383 -0.0298855 10.2059 -3.6784e-05C8.31431 -0.000477834 6.4599 0.514732 4.85001 1.48798C3.24011 2.46124 1.9382 3.85416 1.08984 5.51101L4.38946 8.02225C4.79303 6.82005 5.57145 5.77231 6.61498 5.02675C7.65851 4.28118 8.9145 3.87541 10.2059 3.86663Z"
                        fill="#EB4335"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip0_191_13499">
                        <rect width="20" height="20" fill="white" />
                      </clipPath>
                    </defs>
                  </svg>
                </span>
                Sign up with Google
              </button>

              <div className="mt-6 text-center">
                <p className="text-muted-foreground">
                  Already have an account?{' '}
                  <Link to="/auth/signin" className="text-primary hover:text-primary/80 font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvitationSignUp;

