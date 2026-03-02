// Infrastructure Layer - Security
// Security middleware for financial-grade applications

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import express, { Request, Response, NextFunction } from 'express';

export class SecurityMiddleware {
  // Rate limiting for different endpoints
  static createRateLimiter(windowMs: number = 15 * 60 * 1000, max: number = 100) {
    return rateLimit({
      windowMs,
      max,
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  // Stricter rate limiting for sensitive operations
  static createStrictRateLimiter() {
    return rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10, // 10 requests per 5 minutes
      message: {
        error: 'Too many sensitive operations, please try again later.',
        retryAfter: 300
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  // Authentication rate limiter (very strict)
  static createAuthRateLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 login attempts per 15 minutes
      message: {
        error: 'Too many login attempts, please try again later.',
        retryAfter: 900
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true, // Don't count successful logins
    });
  }

  // Helmet security headers
  static createHelmetConfig() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    });
  }

  // Request sanitization middleware
  static sanitizeRequest() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Basic input sanitization
      for (const key in req.body) {
        if (typeof req.body[key] === 'string') {
          // Remove potential script tags and other dangerous content
          req.body[key] = req.body[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
          req.body[key] = req.body[key].replace(/javascript:/gi, '');
          req.body[key] = req.body[key].replace(/on\w+\s*=/gi, '');
        }
      }

      // Sanitize query parameters
      for (const key in req.query) {
        if (typeof req.query[key] === 'string') {
          req.query[key] = (req.query[key] as string).replace(/[<>'"&]/g, '');
        }
      }

      next();
    };
  }

  // IP whitelist middleware for admin operations
  static ipWhitelist(allowedIPs: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIP = req.ip || req.connection.remoteAddress || '';

      if (!allowedIPs.includes(clientIP)) {
        return res.status(403).json({
          error: 'Access denied: IP address not in whitelist'
        });
      }

      next();
    };
  }

  // Request logging middleware for security monitoring
  static securityLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          userId: (req as any).user?.id,
          timestamp: new Date().toISOString()
        };

        // Log suspicious activities
        if (res.statusCode === 401 || res.statusCode === 403) {
          console.warn('SECURITY EVENT:', JSON.stringify(logData));
        } else if (duration > 10000) { // Slow requests
          console.warn('PERFORMANCE ISSUE:', JSON.stringify(logData));
        } else {
          console.log('REQUEST:', JSON.stringify(logData));
        }
      });

      next();
    };
  }

  // SQL injection protection (additional layer)
  static sqlInjectionProtection() {
    return (req: Request, res: Response, next: NextFunction) => {
      const suspiciousPatterns = [
        /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
        /('|(\\x27)|(\\x2D\\x2D)|(\\#)|(\\x23)|(\%27)|(\%23))/i,
        /(<script|javascript:|vbscript:|onload=|onerror=)/i
      ];

      const checkValue = (value: any): boolean => {
        if (typeof value === 'string') {
          return suspiciousPatterns.some(pattern => pattern.test(value));
        }
        if (typeof value === 'object' && value !== null) {
          return Object.values(value).some(checkValue);
        }
        return false;
      };

      if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
        return res.status(400).json({
          error: 'Bad request: Suspicious input detected'
        });
      }

      next();
    };
  }
}
