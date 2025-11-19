import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dny4qcihn',
  api_key: '691441898462561',
  api_secret: '6VSAxx9pBWmAJhKWbpHgA3KAFxwU',
});

const videoPath = 'C:\\Users\\harol\\Downloads\\Ill_fill_out_202510230100_wjrgz.mp4';

cloudinary.uploader.upload(videoPath, {
  resource_type: 'video',
  public_id: 'gtnpj2cttbh7bffx6mmw'
})
.then(result => {
  console.log('✅ Video uploaded successfully!');
  console.log('Public ID:', result.public_id);
  console.log('URL:', result.secure_url);
})
.catch(error => {
  console.error('❌ Upload failed:', error);
});
