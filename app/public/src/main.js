async function loadImages() {
  try {
    const response = await fetch('/api/images');
    if (!response.ok) {
      throw new Error('Failed to fetch images');
    }
    const images = await response.json();
    displayImages(images);
  } catch (error) {
    console.error('Error loading images:', error);
    const gallery = document.getElementById('gallery');
    if (gallery) {
      gallery.innerHTML = '<p class="error">Failed to load images. Please try again later.</p>';
    }
  }
}

function displayImages(images) {
  const gallery = document.getElementById('gallery');
  if (!gallery) return;

  if (images.length === 0) {
    gallery.innerHTML = '<p>No images uploaded yet.</p>';
    return;
  }

  gallery.innerHTML = images.map(image => {
    const imageUrl = image.location.startsWith('/') ? image.location : `/${image.location}`;
    return `
      <div class="image-card">
        <img src="${imageUrl}" alt="${image.name}" loading="lazy">
        <div class="image-info">
          <p class="image-name">${escapeHtml(image.name)}</p>
          <p class="image-meta">${image.mime_type} • ${formatDate(image.created)}</p>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Load images when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadImages);
} else {
  loadImages();
}

