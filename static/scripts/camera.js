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
            if (data.success && data.images.length > 0) {
                categorizeAndDisplayImages(data.images);
            } else {
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

// Categorize images into during/after feeding based on timing
function categorizeAndDisplayImages(images) {
    const duringImages = [];
    const afterImages = [];

    // Use filename labels instead of timestamp calculation
    images.forEach(filename => {
        // Extract type from filename: CAMERA01_1732584234_during.jpg
        const parts = filename.replace('.jpg', '').split('_');
       
        if (parts.length >= 3) {
            const imageType = parts[2]; // "during" or "after"
           
            if (imageType === 'after') {
                afterImages.push(filename);
            } else {
                duringImages.push(filename);
            }
        } else {
            // Old format without type - default to "during"
            duringImages.push(filename);
        }
    });

    // Sort by timestamp (newest first)
    const sortNewest = (a, b) => {
        const timeA = parseInt(a.split('_')[1]) || 0;
        const timeB = parseInt(b.split('_')[1]) || 0;
        return timeB - timeA;
    };
   
    duringImages.sort(sortNewest);
    afterImages.sort(sortNewest);

    displayCategorizedImages(duringImages, afterImages);
}

// Display categorized images
function displayCategorizedImages(duringImages, afterImages) {
    const duringGallery = document.getElementById('duringFeedingGallery');
    const afterGallery = document.getElementById('afterFeedingGallery');

    if (duringImages.length > 0) {
        duringGallery.innerHTML = '';
        duringImages.forEach(filename => {
            duringGallery.appendChild(createGalleryItem(filename));
        });
    } else {
        showEmptyState(duringGallery, 'during');
    }

    if (afterImages.length > 0) {
        afterGallery.innerHTML = '';
        afterImages.forEach(filename => {
            afterGallery.appendChild(createGalleryItem(filename));
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
function createGalleryItem(filename) {
    const div = document.createElement('div');
    div.className = 'gallery-item';
   
    // Extract info from filename
    const parts = filename.replace('.jpg', '').split('_');
    const cameraId = parts[0] || 'Unknown';
    const timestamp = parts[1] || 'Unknown';
   
    div.innerHTML = `
        <img src="/snapshots/${filename}"
             alt="${filename}"
             onclick="openModal('${filename}'); event.stopPropagation();">
        <div class="info">
            <p class="timestamp">${formatTimestamp(timestamp)}</p>
            <p>📷 Captured by ${cameraId}</p>
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
    if (timestamp === 'Unknown') return 'Unknown Time';
   
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
        alert('✗ Error delating image. Please try again.');

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
