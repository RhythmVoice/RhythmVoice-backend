import dotenv from 'dotenv';

dotenv.config();

const corsOptions = {
  origin: function(origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ?.split(',')
      .map(url => url.trim())
      .filter(Boolean) || [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
      ];

		if (process.env.NODE_ENV === 'development') {
      console.log('CORS check - Origin:', origin);
      console.log('Allowed origins:', allowedOrigins);
    }

    if (allowedOrigins.includes(origin) || !origin) {
      return callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      return callback(
        new Error(`CORS policy violation: ${origin} is not allowed`), 
        false
      );
    }
  },

  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],

  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control'
  ],

  exposedHeaders: [
    'Set-Cookie',
    'Authorization',
    'X-Total-Count'
  ],

  credentials: true,

  maxAge: 86400,
};

export { corsOptions };