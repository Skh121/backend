import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { generateTokenPair } from '../services/token.service.js';
import { logAuthEvent } from '../services/audit.service.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utils/constants.js';
import { securityConfig } from '../config/security.js';
import { createSession } from '../services/session.service.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Google OAuth Login/Signup
 * POST /api/auth/google
 */
export const googleAuth = async (req, res, next) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Google credential is required',
      });
    }

    // Verify the Google token
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (error) {
      console.error('Google token verification error:', error);
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid Google credential',
      });
    }

    const { sub: googleId, email, given_name, family_name, picture, email_verified } = payload;

    if (!email_verified) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Google email is not verified',
      });
    }

    // Check if user exists with this Google ID
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if user exists with this email (might have registered locally)
      user = await User.findOne({ email });

      if (user) {
        // Link Google account to existing user
        if (user.authProvider === 'local') {
          user.googleId = googleId;
          user.authProvider = 'google'; // or keep as 'local' to allow both
          if (!user.profileImage && picture) {
            user.profileImage = picture;
          }
          await user.save();

          logAuthEvent('google_account_linked', req, user, true, 'Google account linked to existing user');
        }
      } else {
        // Create new user with Google account
        user = await User.create({
          email,
          firstName: given_name || 'User',
          lastName: family_name || '',
          googleId,
          authProvider: 'google',
          isEmailVerified: true, // Google email is already verified
          profileImage: picture || null,
          passwordChangedAt: new Date(),
          passwordExpiresAt: new Date(
            Date.now() + securityConfig.password.expiryDays * 24 * 60 * 60 * 1000
          ),
        });

        logAuthEvent('register_google', req, user, true, 'New user registered via Google OAuth');
      }
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Your account has been suspended. Please contact support.',
      });
    }

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const remainingTime = Math.ceil(
        (user.accountLockedUntil - new Date()) / 1000 / 60
      );
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: `Account is locked. Try again in ${remainingTime} minutes.`,
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Hash new refresh token
    const { hashPassword } = await import('../utils/encryption.js');
    const refreshTokenHash = await hashPassword(refreshToken);
    const refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Update user with refresh token
    user.refreshTokenHash = refreshTokenHash;
    user.refreshTokenExpires = refreshTokenExpires;
    user.lastLogin = new Date();
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = null;
    await user.save();

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Create session for idle timeout tracking
    const session = await createSession({
      userId: user._id,
      refreshTokenHash: user.refreshTokenHash,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie('sessionToken', session.sessionToken, {
      ...securityConfig.cookie,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logAuthEvent('login_google', req, user, true, 'User logged in via Google OAuth');

    res.json({
      success: true,
      message: 'Google login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          profileImage: user.profileImage,
          authProvider: user.authProvider,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  googleAuth,
};

