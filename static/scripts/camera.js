// Load snapshots when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadSnapshots();
});

// Load all snapshots from server
function loadSnapshots() {
    const duringGallery = document.getElementById('duringFeedingGallery');
    const afterGallery = document.getElementById('afterFeedingGallery');
   
    duringGallery.innerHTML = '<div class="loading">Loading images...</div>';
    afterGallery.innerHTML = '<div class="loading">Loading images...</div>';
   
    fetch('/api/snapshots')
        .then(response => response.json())
        .then(data => {
            console.log('API Response:', data); // Debug log
           
            if (data.success && data.images && data.images.length > 0) {
                displayCategorizedImages(data.images);
            } else {
                console.log('No images found or empty response');
                showEmptyState(duringGallery, 'during');
                showEmptyState(afterGallery, 'after');
            }
        })
        .catch(error => {
            console.error('Error loading images:', error);
            duringGallery.innerHTML = '<div class="empty-state"><p>❌ Error loading images</p></div>';
            afterGallery.innerHTML = '<div class="empty-state"><p>❌ Error loading images</p></div>';
        });
}

// Display categorized images from database
function displayCategorizedImages(images) {
    const duringGallery = document.getElementById('duringFeedingGallery');
    const afterGallery = document.getElementById('afterFeedingGallery');
   
    console.log('Total images received:', images.length); // Debug log
   
    // Separate images by category (already stored in database)
    const duringImages = images.filter(img => img.category === 'during');
    const afterImages = images.filter(img => img.category === 'after');
   
    console.log('During images:', duringImages.length); // Debug log
    console.log('After images:', afterImages.length); // Debug log
   
    // Display During Feeding images
    if (duringImages.length > 0) {
        duringGallery.innerHTML = '';
        duringImages.forEach(imageData => {
            duringGallery.appendChild(createGalleryItem(imageData));
        });
    } else {
        showEmptyState(duringGallery, 'during');
    }
   
    // Display After Feeding images
    if (afterImages.length > 0) {
        afterGallery.innerHTML = '';
        afterImages.forEach(imageData => {
            afterGallery.appendChild(createGalleryItem(imageData));
        });
    } else {
        showEmptyState(afterGallery, 'after');
    }
}

// Show empty state
function showEmptyState(gallery, type) {
    const message = type === 'during'
        ? '📷 No "During Feeding" images captured yet'
        : '📷 No "After Feeding" images captured yet';
   
    gallery.innerHTML = `
        <div class="empty-state">
            <p>${message}</p>
            <p style="font-size: 14px; color: #ffaa6e;">Images will appear here after feeding events</p>
        </div>
    `;
}

// Create individual gallery item
function createGalleryItem(imageData) {
    const div = document.createElement('div');
    div.className = 'gallery-item';
   
    const filename = imageData.filename;
    const cameraId = imageData.camera_id || 'Unknown';
    const timestamp = imageData.timestamp || 'Unknown';
    const category = imageData.category || 'unknown';
   
    console.log('Creating gallery item:', filename, 'Category:', category); // Debug log
   
    div.innerHTML = `
        <img src="/snapshots/${filename}" alt="${filename}" onclick="openModal('${filename}'); event.stopPropagation();">
        <div class="info">
            <p class="timestamp">${formatTimestamp(timestamp)}</p>
            <p>📷 ${cameraId}</p>
            <p style="font-size: 11px; color: #999;">Category: ${category}</p>
            <p style="font-size: 12px; color: #999;">${filename}</p>
            <button class="delete-btn" onclick="deleteImage('${filename}'); event.stopPropagation();">
                🗑️ Delete
            </button>
        </div>
    `;
   
    return div;
}

// Format timestamp
function formatTimestamp(timestamp) {
    if (timestamp === 'Unknown' || !timestamp) return 'Unknown Time';
   
    try {
        const date = new Date(parseInt(timestamp) * 1000);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return `ID: ${timestamp}`;
    }
}

// Delete image function
function deleteImage(filename) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) {
        return;
    }
   
    fetch(`/api/snapshots/${filename}`, {
        method: 'DELETE'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('✓ Image deleted successfully!');
                refreshGallery();
            } else {
                alert('✗ Failed to delete image: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error deleting image:', error);
            alert('✗ Error deleting image. Please try again.');
        });
}

// Refresh gallery
function refreshGallery() {
    loadSnapshots();
}

// Open image in modal
function openModal(filename) {
    let modal = document.getElementById('imageModal');
   
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'imageModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <span class="close-modal" onclick="closeModal()">&times;</span>
            <img class="modal-content" id="modalImage">
        `;
        document.body.appendChild(modal);
    }
   
    const modalImg = document.getElementById('modalImage');
    modalImg.src = `/snapshots/${filename}`;
    modal.style.display = 'block';
}

// Close modal
function closeModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close modal when clicking outside image
window.onclick = function(event) {
    const modal = document.getElementById('imageModal');
    if (event.target === modal) {
        closeModal();
    }
}
