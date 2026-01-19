import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithGoogle, signInWithEmail, linkGoogleProvider } from './auth';
import { updateAuthToken } from '@/api/whagonsApi';
import { actionsApi } from '@/api/whagonsActionsApi';
import { AuthError, AuthErrorCodes, GoogleAuthProvider } from 'firebase/auth';
import WhagonsTitle from '@/assets/WhagonsTitle';
import { InitializationStage } from '@/types/user';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/providers/LanguageProvider';

const SignIn: React.FC = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const navigate = useNavigate();
  const { firebaseUser, user, loading, userLoading, refetchUser } = useAuth();

  // Random workspace/productivity images
  const workspaceImages = [
    'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?q=80&w=1000&auto=format&fit=crop', // Laptop and notebook
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1000&auto=format&fit=crop', // Office desk with documents
    'https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=1000&auto=format&fit=crop', // Workspace with plant
    'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=1000&auto=format&fit=crop', // Team collaboration
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=1000&auto=format&fit=crop', // Business meeting
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1000&auto=format&fit=crop', // Analytics and planning
    'https://images.unsplash.com/photo-1553877522-43269d4ea984?q=80&w=1000&auto=format&fit=crop', // Office workspace
    'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1000&auto=format&fit=crop', // Modern workspace
    'https://images.unsplash.com/photo-1497366754035-f200368a1e55?q=80&w=1000&auto=format&fit=crop', // Clean desk setup
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=1000&auto=format&fit=crop', // Team workspace
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1000&auto=format&fit=crop', // Collaborative workspace
    'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?q=80&w=1000&auto=format&fit=crop', // Creative workspace
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1000&auto=format&fit=crop', // Focused work
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1000&auto=format&fit=crop', // Modern office
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000&auto=format&fit=crop', // Team discussion
    'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1000&auto=format&fit=crop', // Productive workspace
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1000&auto=format&fit=crop', // Planning session
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1000&auto=format&fit=crop', // Strategy meeting
    'https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=1000&auto=format&fit=crop', // Workspace with technology
    'https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=1000&auto=format&fit=crop', // Modern office space
    'https://images.unsplash.com/photo-1497215842964-222b430dc094?q=80&w=1000&auto=format&fit=crop', // Professional workspace
    'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=1000&auto=format&fit=crop', // Cozy workspace
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1000&auto=format&fit=crop', // Productive desk
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1000&auto=format&fit=crop', // Coding workspace
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop', // Minimalist office
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1000&auto=format&fit=crop', // Team brainstorming
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1000&auto=format&fit=crop', // Organized workspace
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1000&auto=format&fit=crop', // Data visualization workspace
    'https://images.unsplash.com/photo-1496435873459-7d1c8c244ef0?q=80&w=1000&auto=format&fit=crop', // Remote workspace
    'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=1000&auto=format&fit=crop', // Workspace with notes
    'https://images.unsplash.com/photo-1496435873459-7d1c8c244ef0?q=80&w=1000&auto=format&fit=crop', // Remote workspace
    'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1000&auto=format&fit=crop', // Modern workspace
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=1000&auto=format&fit=crop', // Team meeting space
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1000&auto=format&fit=crop', // Team collaboration space
    'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?q=80&w=1000&auto=format&fit=crop', // Creative office space
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1000&auto=format&fit=crop', // Focused workspace
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1000&auto=format&fit=crop', // Contemporary office
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000&auto=format&fit=crop', // Team workspace meeting
    'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1000&auto=format&fit=crop', // Efficient workspace
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1000&auto=format&fit=crop', // Business planning
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1000&auto=format&fit=crop', // Strategic planning
    'https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=1000&auto=format&fit=crop', // Tech-focused workspace
    'https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=1000&auto=format&fit=crop', // Modern collaborative space
    'https://images.unsplash.com/photo-1497215842964-222b430dc094?q=80&w=1000&auto=format&fit=crop', // Professional office environment
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1000&auto=format&fit=crop', // Productive environment
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1000&auto=format&fit=crop', // Developer workspace
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop', // Clean office space
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1000&auto=format&fit=crop', // Team collaboration session
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1000&auto=format&fit=crop', // Well-organized desk
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1000&auto=format&fit=crop', // Analytics workspace
    'https://images.unsplash.com/photo-1497366754035-f200368a1e55?q=80&w=1000&auto=format&fit=crop', // Clean modern desk
    'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=1000&auto=format&fit=crop', // Cozy workspace
    'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=1000&auto=format&fit=crop', // Workspace with notes
    'https://images.unsplash.com/photo-1496435873459-7d1c8c244ef0?q=80&w=1000&auto=format&fit=crop', // Remote workspace
    'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1000&auto=format&fit=crop', // Modern workspace
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=1000&auto=format&fit=crop', // Team meeting space
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1000&auto=format&fit=crop', // Team collaboration space
    'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?q=80&w=1000&auto=format&fit=crop', // Creative office space
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1000&auto=format&fit=crop', // Focused workspace
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1000&auto=format&fit=crop', // Contemporary office
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000&auto=format&fit=crop', // Team workspace meeting
    'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1000&auto=format&fit=crop', // Efficient workspace
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1000&auto=format&fit=crop', // Business planning
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1000&auto=format&fit=crop', // Strategic planning
    'https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=1000&auto=format&fit=crop', // Tech-focused workspace
    'https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=1000&auto=format&fit=crop', // Modern collaborative space
    'https://images.unsplash.com/photo-1497215842964-222b430dc094?q=80&w=1000&auto=format&fit=crop', // Professional office environment
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1000&auto=format&fit=crop', // Productive environment
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1000&auto=format&fit=crop', // Developer workspace
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop', // Clean office space
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1000&auto=format&fit=crop', // Team collaboration session
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1000&auto=format&fit=crop', // Well-organized desk
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1000&auto=format&fit=crop', // Analytics workspace
    'https://images.unsplash.com/photo-1497366754035-f200368a1e55?q=80&w=1000&auto=format&fit=crop', // Clean modern desk
    'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=1000&auto=format&fit=crop', // Cozy workspace
  ];
  
  const [randomImage] = useState(() => workspaceImages[Math.floor(Math.random() * workspaceImages.length)]);

  async function checkPassword() {
    //make sure password meets requirements and confirm password matches
    const regex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/;
    if (!regex.test(password)) {
      //toast error
      alert(
        t('auth.passwordRequirements', 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number')
      );
      return false;
    }

    return true;
  }

  async function backendLogin(idToken: string) {
    try {
      console.log('idToken', idToken);

      const response = await actionsApi.post(`/login`,
        {
          "token": idToken
        },
      );

      if (response.status === 200) {
        console.log('Successfully logged in and sent idToken to backend');
        updateAuthToken(response.data.token);
        
        // Refetch user data after login - the useEffect will handle redirect once user data is loaded
        await refetchUser();
        
        return true;
      } else {
        console.error('Login failed with status:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }

  const handleGoogleSignin = async () => {
    setIsGoogleLoading(true);
    try {
      const userCredential = await signInWithGoogle();
      const user = userCredential.user;
      const idToken = await user.getIdToken();
      const loginSuccess = await backendLogin(idToken);
      if (!loginSuccess) {
        alert(t('auth.loginFailed', 'Login failed. Please try again.'));
      }
    } catch (error: any) {
      const authError = error as AuthError;
      if (authError.code === AuthErrorCodes.CREDENTIAL_ALREADY_IN_USE || authError.code === 'auth/account-exists-with-different-credential') {
        // An account with this email exists with a different provider
        const email = authError.customData?.email;
        if (email) {
          alert(t('auth.accountExists', 'An account with this email already exists. Please sign in with your email and password first, then link your Google account.'));
          // Optionally, prompt the user to sign in with email/password and then link Google
          navigate('/auth/signin', { state: { email, linkGoogle: true } });
        } else {
          alert(t('auth.googleSignInFailed', 'Google sign-in failed. Please try again.'));
        }
      } else {
        console.error('Google sign-in error:', error);
        alert(t('auth.googleSignInFailed', 'Google sign-in failed. Please try again.'));
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleEmailSignin = async () => {
    setIsLoading(true);
    try {
      // If already authenticated with Firebase (e.g., reload), reuse that session
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const ok = await backendLogin(idToken);
          if (!ok) alert(t('auth.loginFailed', 'Login failed. Please try again.'));
        } catch (e) {
          console.error('Reusing Firebase session failed:', e);
          alert(t('auth.loginFailed', 'Login failed. Please try again.'));
        }
        return;
      }

      // 1) Validate password locally
      if (!(await checkPassword())) {
        return;
      }

      // 2) Firebase sign-in (only this block shows the "Email sign-in failed" alert)
      let userCredential;
      try {
        userCredential = await signInWithEmail(email, password);
      } catch (error) {
        console.error('Email sign-in error (Firebase):', error);
        alert(t('auth.emailSignInFailed', 'Email sign-in failed. Please try again.'));
        return; // Do not logout here; let auth state remain untouched
      }

      // 3) Get ID token
      let idToken: string | null = null;
      try {
        idToken = await userCredential.user.getIdToken();
      } catch (error) {
        console.error('Failed to get ID token:', error);
        alert(t('auth.loginFailed', 'Login failed. Please try again.'));
        return;
      }

      // 4) Backend login for API token; on failure, show a targeted message
      const loginSuccess = await backendLogin(idToken);
      if (!loginSuccess) {
        alert(t('auth.loginFailed', 'Login failed. Please try again.'));
        return;
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle linking Google account after email sign-in (if redirected from Google sign-in)
  const handleGoogleLink = async () => {
    try {
      const userCredential = await signInWithGoogle();
      const credential = GoogleAuthProvider.credentialFromResult(userCredential);
      if (credential) {
        await linkGoogleProvider(credential);
        const idToken = await userCredential.user.getIdToken();
        const loginSuccess = await backendLogin(idToken);
        if (!loginSuccess) {
          alert(t('auth.failedToLinkGoogle', 'Failed to link Google account. Please try again.'));
        }
      }
    } catch (error) {
      console.error('Google linking error:', error);
      alert(t('auth.failedToLinkGoogle', 'Failed to link Google account. Please try again.'));
    }
  };


  // Redirect away from SignIn if already authenticated (handles page reloads)
  useEffect(() => {
    if (loading) return; // wait for auth state init
    if (firebaseUser && !userLoading && user) {
      if (user.initialization_stage !== InitializationStage.COMPLETED) {
        navigate('/onboarding');
      } else {
        navigate('/');
      }
    }
  }, [loading, userLoading, firebaseUser, user, navigate]);

  useEffect(() => {
    const { linkGoogle } = (navigate as any).location?.state || {};
    if (linkGoogle) {
      handleGoogleLink();
    }
  }, [navigate]);

  return (
    <div 
      className="flex items-center justify-center min-h-screen px-4 py-4 sm:px-6 lg:px-8 relative bg-gradient-to-br from-background via-background to-muted/20"
      style={{
        backgroundImage: `url('/images/onboarding/gradient-waves.svg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]"></div>
      <div className="relative z-10 rounded-xl border border-border bg-card shadow-2xl dark:shadow-2xl max-w-5xl w-full overflow-hidden backdrop-blur-sm my-4">
        <div className="flex flex-wrap items-stretch">
          <div className="hidden w-full xl:block xl:w-1/2 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
            <div className="py-12 px-10 text-center h-full flex flex-col justify-center">
              <Link className="mb-6 inline-block transition-transform hover:scale-105" to="/">
                <WhagonsTitle />
              </Link>

              <p className="text-muted-foreground text-base mb-6">
                {t('auth.welcome', 'Welcome to Whagons - Your workspace management platform.')}
              </p>

              <div className="mt-4 flex items-center justify-center">
                <div className="relative w-full max-w-[260px]">
                  {/* iPhone 15 mockup using actual device image */}
                  <div className="relative mx-auto">
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-primary/20 rounded-[3rem] blur-2xl transform scale-105"></div>
                    
                    {/* iPhone 15 device frame */}
                    <div className="relative">
                      {/* The actual iPhone mockup image as background */}
                      <div className="relative" style={{ aspectRatio: '430/878' }}>
                        <img 
                          src="https://mockuphone.com/images/mockup_templates/apple-iphone-15-black-portrait.png"
                          alt="iPhone 15"
                          className="w-full h-auto"
                        />
                        
                        {/* Video content positioned inside the phone screen */}
                        <div className="absolute top-[4.5%] left-[7%] right-[7%] bottom-[7%] overflow-hidden rounded-[2.8rem] bg-gradient-to-br from-primary/20 to-primary/5">
                          <img
                            src={randomImage}
                            alt="Task Management"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full border-t xl:border-t-0 xl:border-l border-border xl:w-1/2">
            <div className="w-full p-8 sm:p-10 xl:p-12">
              <div className="max-w-md mx-auto">
                <span className="mb-2 block text-sm font-medium text-muted-foreground">{t('auth.startForFree', 'Start for free')}</span>
                <h2 className="mb-6 text-3xl font-bold text-foreground sm:text-3xl tracking-tight">
                  {t('auth.signInToWhagons', 'Sign In to Whagons')}
                </h2>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      {t('auth.email', 'Email')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        placeholder={t('auth.enterYourEmail', 'Enter your email')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-10 pl-11 pr-4"
                        disabled={isLoading || isGoogleLoading}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 22 22"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <g opacity="0.6">
                            <path
                              d="M19.2516 3.30005H2.75156C1.58281 3.30005 0.585938 4.26255 0.585938 5.46567V16.6032C0.585938 17.7719 1.54844 18.7688 2.75156 18.7688H19.2516C20.4203 18.7688 21.4172 17.8063 21.4172 16.6032V5.4313C21.4172 4.26255 20.4203 3.30005 19.2516 3.30005ZM19.2516 4.84692C19.2859 4.84692 19.3203 4.84692 19.3547 4.84692L11.0016 10.2094L2.64844 4.84692C2.68281 4.84692 2.71719 4.84692 2.75156 4.84692H19.2516ZM19.2516 17.1532H2.75156C2.40781 17.1532 2.13281 16.8782 2.13281 16.5344V6.35942L10.1766 11.5157C10.4172 11.6875 10.6922 11.7563 10.9672 11.7563C11.2422 11.7563 11.5172 11.6875 11.7578 11.5157L19.8016 6.35942V16.5688C19.8703 16.9125 19.5953 17.1532 19.2516 17.1532Z"
                              fill="currentColor"
                            />
                          </g>
                        </svg>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      {t('auth.password', 'Password')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type="password"
                        placeholder={t('auth.passwordPlaceholder', 'Enter your password')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-10 pl-11 pr-4"
                        disabled={isLoading || isGoogleLoading}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isLoading && !isGoogleLoading) {
                            handleEmailSignin();
                          }
                        }}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 22 22"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <g opacity="0.6">
                            <path
                              d="M16.1547 6.80626V5.91251C16.1547 3.16251 14.0922 0.825009 11.4797 0.618759C10.0359 0.481259 8.59219 0.996884 7.52656 1.95938C6.46094 2.92188 5.84219 4.29688 5.84219 5.70626V6.80626C3.84844 7.18438 2.33594 8.93751 2.33594 11.0688V17.2906C2.33594 19.5594 4.19219 21.3813 6.42656 21.3813H15.5016C17.7703 21.3813 19.6266 19.525 19.6266 17.2563V11C19.6609 8.93751 18.1484 7.21876 16.1547 6.80626ZM8.55781 3.09376C9.31406 2.40626 10.3109 2.06251 11.3422 2.16563C13.1641 2.33751 14.6078 3.98751 14.6078 5.91251V6.70313H7.38906V5.67188C7.38906 4.70938 7.80156 3.78126 8.55781 3.09376ZM18.1141 17.2906C18.1141 18.7 16.9453 19.8688 15.5359 19.8688H6.46094C5.05156 19.8688 3.91719 18.7344 3.91719 17.325V11.0688C3.91719 9.52189 5.15469 8.28438 6.70156 8.28438H15.2953C16.8422 8.28438 18.1141 9.52188 18.1141 11V17.2906Z"
                              fill="currentColor"
                            />
                            <path
                              d="M10.9977 11.8594C10.5852 11.8594 10.207 12.2031 10.207 12.65V16.2594C10.207 16.6719 10.5508 17.05 10.9977 17.05C11.4102 17.05 11.7883 16.7063 11.7883 16.2594V12.6156C11.7883 12.2031 11.4102 11.8594 10.9977 11.8594Z"
                              fill="currentColor"
                            />
                          </g>
                        </svg>
                      </span>
                    </div>
                  </div>

                  <Button
                    cypress-id="signin-button"
                    onClick={handleEmailSignin}
                    disabled={isLoading || isGoogleLoading}
                    className="w-full h-10 text-sm font-medium"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('auth.signingIn', 'Signing in...')}
                      </>
                    ) : (
                      t('auth.signIn', 'Sign In')
                    )}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">{t('auth.orContinueWith', 'Or continue with')}</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleGoogleSignin}
                    disabled={isLoading || isGoogleLoading}
                    className="w-full h-10 text-sm font-medium"
                  >
                    {isGoogleLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('auth.signingIn', 'Signing in...')}
                      </>
                    ) : (
                      <>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="mr-2"
                        >
                          <g clipPath="url(#clip0_191_13499)">
                            <path
                              d="M19.999 10.2217C20.0111 9.53428 19.9387 8.84788 19.7834 8.17737H10.2031V11.8884H15.8266C15.7201 12.5391 15.4804 13.162 15.1219 13.7195C14.7634 14.2771 14.2935 14.7578 13.7405 15.1328L13.7209 15.2571L16.7502 17.5568L16.96 17.5774C18.8873 15.8329 19.9986 13.2661 19.9986 10.2217"
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
                        {t('auth.signInWithGoogle', 'Sign in with Google')}
                      </>
                    )}
                  </Button>

                  <div className="pt-3 text-center">
                    <p className="text-sm text-muted-foreground">
                      {t('auth.dontHaveAccount', 'Don\'t have an account?')}{' '}
                      <Link 
                        to="/auth/signup" 
                        className="text-primary hover:text-primary/80 font-medium transition-colors underline-offset-4 hover:underline"
                      >
                        {t('auth.signUp', 'Sign Up')}
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
