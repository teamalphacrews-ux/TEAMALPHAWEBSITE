import sharp from 'sharp';

async function cropIcon() {
  try {
    await sharp('public/logo.png')
      .trim()
      .toFile('public/favicon.png');
    console.log('Successfully cropped the logo!');
  } catch (err) {
    console.error('Error trimming image:', err);
  }
}

cropIcon();
