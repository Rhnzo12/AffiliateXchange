import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dny4qcihn',
  api_key: '691441898462561',
  api_secret: '6VSAxx9pBWmAJhKWbpHgA3KAFxwU',
});

cloudinary.api.resource('atpvv1z6vyft1guhekdj', { resource_type: 'video' })
.then(result => {
  console.log('✅ Video found in Cloudinary!');
  console.log('URL:', result.secure_url);
})
.catch(error => {
  console.error('❌ Cannot find video:', error);
});
