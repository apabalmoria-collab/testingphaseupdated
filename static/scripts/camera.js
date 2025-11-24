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

    // Sort images by timestamp (oldest first for proper pairing)
    images.sort((a, b) => {
        const timeA = parseInt(a.split('_')[1]) || 0;
        const timeB = parseInt(b.split('_')[1]) || 0;
        return timeA - timeB; // Ascending order (oldest first)
    });

    // Track which images have been paired
    const paired = new Set();

    // Look for pairs: images captured 2.5-5.5 minutes apart
    // This accounts for:
    // - During Feeding: 15 sec after dispense
    // - After Feeding: 3-5 min after dispense
    // - Gap range: 165-285 sec ideal, with buffer for delays
    for (let i = 0; i < images.length; i++) {
        if (paired.has(i)) continue; // Skip already paired images
       
        const currentTime = parseInt(images[i].split('_')[1]) || 0;
       
        // Look ahead through ALL remaining images (not just next one)
        for (let j = i + 1; j < images.length; j++) {
            if (paired.has(j)) continue;
           
            const nextTime = parseInt(images[j].split('_')[1]) || 0;
            const timeDiff = nextTime - currentTime; // in seconds

            // Allow 2.5-5.5 minutes (150-330 seconds) for real-world conditions
            // - Ideal gap: 165-285 seconds (2:45 - 4:45)
            // - Buffer: ±15-45 sec for network/upload delays
            if (timeDiff >= 270 && timeDiff <= 330) {
                // First image is "during", second is "after"
                duringImages.push(images[i]);
                afterImages.push(images[j]);
                paired.add(i);
                paired.add(j);
                break; // Found a pair, move to next unpaired image
            }
           
            // If gap is too large (>5.5 minutes), stop looking
            if (timeDiff > 330) {
                break;
            }
        }
    }

    // Any unpaired images default to "during feeding"
    for (let i = 0; i < images.length; i++) {
        if (!paired.has(i)) {
            duringImages.push(images[i]);
        }
    }

    // Sort both arrays by timestamp (newest first for display)
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