/**
 * Script to configure CORS for Google Cloud Storage bucket
 * Run with: npx tsx server/configure-cors.ts
 */

import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

dotenv.config();

async function configureCORS() {
  try {
    // Initialize Google Cloud Storage
    let storage: Storage;

    // Option 1: Use credentials from JSON string (best for production/Render)
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credentialsJson) {
      const credentials = JSON.parse(credentialsJson);
      storage = new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
        credentials,
      });
      console.log('Using credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON');
    }
    // Option 2: Use key file path (for local development)
    else if (process.env.GOOGLE_CLOUD_KEYFILE) {
      storage = new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        keyFilename: process.env.GOOGLE_CLOUD_KEYFILE,
      });
      console.log('Using key file from GOOGLE_CLOUD_KEYFILE');
    }
    // Option 3: Fallback to default credentials
    else {
      storage = new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      });
      console.log('Using default credentials');
    }

    const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'myapp-media-affiliate';
    const bucket = storage.bucket(bucketName);

    // CORS configuration
    const corsConfiguration = [
      {
        origin: ['http://localhost:3000', 'http://localhost:5000', 'https://*.vercel.app'],
        method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        responseHeader: ['Content-Type', 'Access-Control-Allow-Origin'],
        maxAgeSeconds: 3600,
      },
    ];

    console.log('Configuring CORS for bucket:', bucketName);
    console.log('CORS configuration:', JSON.stringify(corsConfiguration, null, 2));

    await bucket.setCorsConfiguration(corsConfiguration);

    console.log('\n✅ CORS configuration applied successfully!');
    console.log('\nYou can now upload files from:');
    console.log('  - http://localhost:3000');
    console.log('  - http://localhost:5000');
    console.log('  - Any Vercel deployment (*.vercel.app)');

    // Verify the configuration
    const [metadata] = await bucket.getMetadata();
    console.log('\nVerified CORS configuration:');
    console.log(JSON.stringify(metadata.cors, null, 2));

  } catch (error: any) {
    console.error('❌ Error configuring CORS:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

configureCORS();
