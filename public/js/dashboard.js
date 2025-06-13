// Connect to Socket.io
const socket = io();

// DOM Elements
const createNewGroupBtn = document.getElementById('createNewGroupBtn');
const createGroupModal = document.getElementById('createGroupModal');
const groupDetailsModal = document.getElementById('groupDetailsModal');
const createGroupBtn = document.getElementById('createGroupBtn');
const joinExistingGroupBtn = document.getElementById('joinExistingGroupBtn');
const joinGroupFromDetails = document.getElementById('joinGroupFromDetails');
const emptyStateCreateBtn = document.getElementById('emptyStateCreateBtn');
const navLogoutBtn = document.getElementById('navLogoutBtn');

// Quick action buttons
const createGroupAction = document.getElementById('createGroupAction');
const shareLocationAction = document.getElementById('shareLocationAction');
const updateProfileAction = document.getElementById('updateProfileAction');

// Global Variables
let currentGroupId = null;
let groups = [];
let currentUser = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Load user data from localStorage
    const userJSON = localStorage.getItem('user');
    if (userJSON) {
        try {
            currentUser = JSON.parse(userJSON);
            
            // Update the welcome message with the user's name
            const userDisplayName = document.getElementById('userDisplayName');
            if (userDisplayName) {
                userDisplayName.textContent = `Welcome back, ${currentUser.name}!`;
            }
        } catch (error) {
            console.error('Error parsing user data:', error);
            // Create a mock user if parsing fails
            currentUser = {
                id: 'mock-' + Date.now().toString(),
                name: 'Guest User',
                email: 'guest@example.com'
            };
            localStorage.setItem('user', JSON.stringify(currentUser));
        }
    } else {
        // Create a mock user if none exists
        currentUser = {
            id: 'mock-' + Date.now().toString(),
            name: 'Guest User',
            email: 'guest@example.com'
        };
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        // Update the welcome message with the user's name
        const userDisplayName = document.getElementById('userDisplayName');
        if (userDisplayName) {
            userDisplayName.textContent = `Welcome back, ${currentUser.name}!`;
        }
    }
    
    // Load groups from localStorage
    loadGroups();
    
    // Setup event listeners
    setupEventListeners();
});

// Load groups from localStorage
function loadGroups() {
    groups = JSON.parse(localStorage.getItem('groups') || '[]');
    updateGroupsList();
}

// Update the groups list in the UI
function updateGroupsList() {
    const userGroupsList = document.getElementById('userGroupsList');
    
    if (!userGroupsList) return;
    
    if (groups.length === 0) {
        userGroupsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users-slash"></i>
                <p>You haven't joined any groups yet.</p>
                <button id="emptyStateCreateBtn" class="action-button">Create Your First Group</button>
            </div>
        `;
        
        // Add event listener to the button
        document.getElementById('emptyStateCreateBtn').addEventListener('click', () => {
            showCreateGroupModal();
        });
    } else {
        userGroupsList.innerHTML = '';
        
        groups.forEach(group => {
            const groupCard = document.createElement('div');
            groupCard.className = 'group-card';
            groupCard.dataset.groupId = group.id;
            
            groupCard.innerHTML = `
                <div class="group-card-header">
                    <div class="group-icon">
                        ${group.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="group-info">
                        <h3>${group.name}</h3>
                        <p>${group.members.length} members</p>
                    </div>
                </div>
                <div class="group-card-actions">
                    <button class="view-group-btn" data-group-id="${group.id}">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="join-tracking-btn" data-group-id="${group.id}">
                        <i class="fas fa-map-marker-alt"></i> Join
                    </button>
                </div>
            `;
            
            userGroupsList.appendChild(groupCard);
            
            // Add event listeners
            groupCard.querySelector('.view-group-btn').addEventListener('click', (e) => {
                showGroupDetails(e.target.dataset.groupId || group.id);
            });
            
            groupCard.querySelector('.join-tracking-btn').addEventListener('click', (e) => {
                joinGroupTracking(e.target.dataset.groupId || group.id);
            });
        });
    }
    
    // Also update available groups in the sidebar
    updateAvailableGroups();
}

// Update available groups in the sidebar
function updateAvailableGroups() {
    const availableGroupsList = document.getElementById('availableGroupsList');
    
    if (!availableGroupsList) return;
    
    // In a real app, you'd fetch this from the server
    // For demo purposes, we'll create some mock groups
    const mockAvailableGroups = [
        {
            id: 'public1',
            name: 'City Explorers',
            creatorName: 'Sarah Johnson',
            members: Array(8).fill({}),
            onlineMembers: 3
        },
        {
            id: 'public2',
            name: 'Weekend Hikers',
            creatorName: 'Mike Chen',
            members: Array(12).fill({}),
            onlineMembers: 5
        },
        {
            id: 'public3',
            name: 'Urban Adventures',
            creatorName: 'Elena Smith',
            members: Array(6).fill({}),
            onlineMembers: 2
        }
    ];
    
    // Filter out groups the user is already in
    const userGroupIds = groups.map(g => g.id);
    const filteredGroups = mockAvailableGroups.filter(g => !userGroupIds.includes(g.id));
    
    if (filteredGroups.length === 0) {
        availableGroupsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-globe-americas"></i>
                <p>No public groups available to join.</p>
            </div>
        `;
    } else {
        availableGroupsList.innerHTML = '';
        
        filteredGroups.forEach(group => {
            const groupCard = document.createElement('div');
            groupCard.className = 'group-preview-card';
            groupCard.dataset.groupId = group.id;
            
            groupCard.innerHTML = `
                <div class="group-preview-info">
                    <h3>${group.name}</h3>
                    <p>Created by ${group.creatorName}</p>
                    <div class="group-stats">
                        <div class="stat-item">
                            <span class="stat-value">${group.members.length}</span>
                            <span class="stat-label">Members</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value online">${group.onlineMembers}</span>
                            <span class="stat-label">Online</span>
                        </div>
                    </div>
                </div>
                <div class="group-preview-actions">
                    <button class="view-details-btn" data-group-id="${group.id}">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                    <button class="join-group-btn" data-group-id="${group.id}">
                        <i class="fas fa-user-plus"></i> Join
                    </button>
                </div>
            `;
            
            availableGroupsList.appendChild(groupCard);
            
            // Add event listeners
            groupCard.querySelector('.view-details-btn').addEventListener('click', (e) => {
                showGroupDetails(e.target.dataset.groupId || group.id, true);
            });
            
            groupCard.querySelector('.join-group-btn').addEventListener('click', (e) => {
                joinGroup(e.target.dataset.groupId || group.id);
            });
        });
    }
}

// Setup event listeners
function setupEventListeners() {
    // Create Group Modal
    if (createNewGroupBtn) {
        createNewGroupBtn.addEventListener('click', showCreateGroupModal);
    }
    
    // Close modal buttons
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            hideModals();
        });
    });
    
    // Create group button
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', handleCreateGroup);
    }
    
    // Join existing group button
    if (joinExistingGroupBtn) {
        joinExistingGroupBtn.addEventListener('click', handleJoinExistingGroup);
    }
    
    // Join group from details modal
    if (joinGroupFromDetails) {
        joinGroupFromDetails.addEventListener('click', () => {
            if (currentGroupId) {
                joinGroup(currentGroupId);
                hideModals();
            }
        });
    }
    
    // Quick action buttons
    if (createGroupAction) {
        createGroupAction.addEventListener('click', showCreateGroupModal);
    }
    
    if (shareLocationAction) {
        shareLocationAction.addEventListener('click', () => {
            window.location.href = '/';
        });
    }
    
    if (updateProfileAction) {
        updateProfileAction.addEventListener('click', () => {
            showNotification('Profile update feature coming soon!', 'info');
        });
    }
    
    // Logout button
    if (navLogoutBtn) {
        navLogoutBtn.addEventListener('click', () => {
            localStorage.removeItem('user');
            window.location.href = '/login';
        });
    }
}

// Show create group modal
function showCreateGroupModal() {
    if (createGroupModal) {
        createGroupModal.classList.remove('hidden');
        setTimeout(() => {
            createGroupModal.classList.add('visible');
        }, 10);
        
        // Reset form
        document.getElementById('groupName').value = '';
        document.getElementById('joinGroupId').value = '';
        document.getElementById('groupCreatedSection').classList.add('hidden');
    }
}

// Show group details
function showGroupDetails(groupId, isPublicGroup = false) {
    currentGroupId = groupId;
    
    // Find the group data (either from user's groups or mock available groups)
    let group;
    
    if (isPublicGroup) {
        // In a real app, you'd fetch this from the server
        // For demo purposes, we'll create some mock group details
        const mockAvailableGroups = [
            {
                id: 'public1',
                name: 'City Explorers',
                creatorName: 'Sarah Johnson',
                createdAt: '2023-04-15T10:30:00Z',
                description: 'A group for exploring urban landscapes and city adventures.',
                members: [
                    { id: 'user1', name: 'Sarah Johnson', role: 'admin', status: 'online' },
                    { id: 'user2', name: 'Alex Thompson', role: 'member', status: 'online' },
                    { id: 'user3', name: 'Miguel Sanchez', role: 'member', status: 'offline' },
                    { id: 'user4', name: 'Lisa Wong', role: 'member', status: 'online' },
                    { id: 'user5', name: 'Jordan Clark', role: 'member', status: 'offline' },
                    { id: 'user6', name: 'Emma Davis', role: 'member', status: 'offline' },
                    { id: 'user7', name: 'Raj Patel', role: 'member', status: 'offline' },
                    { id: 'user8', name: 'Olivia Martinez', role: 'member', status: 'offline' }
                ],
                onlineMembers: 3
            },
            {
                id: 'public2',
                name: 'Weekend Hikers',
                creatorName: 'Mike Chen',
                createdAt: '2023-03-22T14:15:00Z',
                description: 'Weekend hiking and trail exploration group for nature lovers.',
                members: [
                    { id: 'user10', name: 'Mike Chen', role: 'admin', status: 'online' },
                    { id: 'user11', name: 'Jessica Lee', role: 'member', status: 'online' },
                    { id: 'user12', name: 'David Kim', role: 'member', status: 'online' },
                    { id: 'user13', name: 'Samantha Brown', role: 'member', status: 'online' },
                    { id: 'user14', name: 'Carlos Rodriguez', role: 'member', status: 'online' },
                    { id: 'user15', name: 'Aisha Johnson', role: 'member', status: 'offline' },
                    { id: 'user16', name: 'Tyler Wilson', role: 'member', status: 'offline' },
                    { id: 'user17', name: 'Sophia Miller', role: 'member', status: 'offline' },
                    { id: 'user18', name: 'Ethan Davis', role: 'member', status: 'offline' },
                    { id: 'user19', name: 'Maya Patel', role: 'member', status: 'offline' },
                    { id: 'user20', name: 'Lucas Martin', role: 'member', status: 'offline' },
                    { id: 'user21', name: 'Zoe Adams', role: 'member', status: 'offline' }
                ],
                onlineMembers: 5
            },
            {
                id: 'public3',
                name: 'Urban Adventures',
                creatorName: 'Elena Smith',
                createdAt: '2023-05-05T09:45:00Z',
                description: 'Exploring urban environments and city adventures together.',
                members: [
                    { id: 'user30', name: 'Elena Smith', role: 'admin', status: 'online' },
                    { id: 'user31', name: 'Nathan Johnson', role: 'member', status: 'online' },
                    { id: 'user32', name: 'Isabella Martinez', role: 'member', status: 'offline' },
                    { id: 'user33', name: 'William Lee', role: 'member', status: 'offline' },
                    { id: 'user34', name: 'Sophia Chen', role: 'member', status: 'offline' },
                    { id: 'user35', name: 'James Wilson', role: 'member', status: 'offline' }
                ],
                onlineMembers: 2
            }
        ];
        
        group = mockAvailableGroups.find(g => g.id === groupId);
    } else {
        group = groups.find(g => g.id === groupId);
    }
    
    if (!group) {
        showNotification('Group not found', 'error');
        return;
    }
    
    // Update modal content
    document.getElementById('detailsGroupName').textContent = group.name;
    
    const groupDetailsContent = document.getElementById('groupDetailsContent');
    groupDetailsContent.innerHTML = `
        <div class="group-details-header">
            <h3>${group.name}</h3>
            <p>Created by ${group.creatorName || 'Unknown'} on ${formatDate(group.createdAt)}</p>
        </div>
        
        <div class="group-details-stats">
            <div class="stat-item">
                <span class="stat-value">${group.members.length}</span>
                <span class="stat-label">Members</span>
            </div>
            <div class="stat-item">
                <span class="stat-value online">${group.onlineMembers || group.members.filter(m => m.status === 'online').length}</span>
                <span class="stat-label">Online</span>
            </div>
        </div>
        
        <div class="members-list-container">
            <h3>Members</h3>
            <div class="members-list">
                ${group.members.map(member => `
                    <div class="member-item">
                        <div class="member-avatar">
                            ${member.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="member-info">
                            <div class="member-name">${member.name}</div>
                            <div class="member-role">${member.role || 'Member'}</div>
                        </div>
                        <div class="member-status ${member.status === 'online' ? 'online' : ''}">
                            ${member.status === 'online' ? 'Online' : 'Offline'}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Show modal
    groupDetailsModal.classList.remove('hidden');
    setTimeout(() => {
        groupDetailsModal.classList.add('visible');
    }, 10);
}

// Hide all modals
function hideModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    });
}

// Handle create group form submission
function handleCreateGroup() {
    const groupNameInput = document.getElementById('groupName');
    const groupName = groupNameInput.value.trim();
    
    if (!groupName) {
        showNotification('Please enter a group name', 'error');
        return;
    }
    
    // Create the group
    const groupId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const userId = currentUser.id;
    
    const newGroup = {
        id: groupId,
        name: groupName,
        createdBy: userId,
        creatorName: currentUser.name,
        createdAt: new Date().toISOString(),
        members: [{ id: userId, name: currentUser.name, role: 'admin', status: 'online' }]
    };
    
    // Add to groups
    groups.push(newGroup);
    localStorage.setItem('groups', JSON.stringify(groups));
    
    // Generate share link
    const shareLink = `${window.location.origin}/join-group/${groupId}?name=${encodeURIComponent(groupName)}`;
    document.getElementById('groupShareLink').value = shareLink;
    document.getElementById('groupCreatedSection').classList.remove('hidden');
    
    // Setup copy button
    document.getElementById('copyGroupLinkBtn').addEventListener('click', () => {
        const input = document.getElementById('groupShareLink');
        input.select();
        document.execCommand('copy');
        showNotification('Link copied to clipboard!', 'success');
    });
    
    // Update UI
    updateGroupsList();
    showNotification(`Group "${groupName}" created successfully!`, 'success');
}

// Handle join existing group
function handleJoinExistingGroup() {
    const groupIdInput = document.getElementById('joinGroupId');
    const groupIdOrLink = groupIdInput.value.trim();
    
    if (!groupIdOrLink) {
        showNotification('Please enter a group ID or invite link', 'error');
        return;
    }
    
    // Check if it's a full URL or just an ID
    let groupId = groupIdOrLink;
    let groupName = "Group";
    
    // If it's a URL, extract the group ID
    if (groupIdOrLink.includes('/join-group/')) {
        try {
            const url = new URL(groupIdOrLink);
            const pathParts = url.pathname.split('/');
            groupId = pathParts[pathParts.length - 1];
            
            // Try to get the group name from the URL
            const params = new URLSearchParams(url.search);
            if (params.has('name')) {
                groupName = params.get('name');
            }
        } catch (e) {
            showNotification('Invalid group link format', 'error');
            return;
        }
    }
    
    joinGroup(groupId, groupName);
}

// Join a group
function joinGroup(groupId, groupName = 'Group') {
    // In a real app, you'd fetch the group details from the server
    // For demo purposes, we'll check if it's one of our mock groups
    const mockGroups = [
        { id: 'public1', name: 'City Explorers' },
        { id: 'public2', name: 'Weekend Hikers' },
        { id: 'public3', name: 'Urban Adventures' }
    ];
    
    const mockGroup = mockGroups.find(g => g.id === groupId);
    if (mockGroup) {
        groupName = mockGroup.name;
    }
    
    // Check if already in group
    if (groups.some(g => g.id === groupId)) {
        showNotification(`You're already a member of "${groupName}"`, 'info');
        hideModals();
        return;
    }
    
    // Create the group in localStorage
    const newGroup = {
        id: groupId,
        name: groupName,
        createdBy: 'external',
        creatorName: mockGroup ? mockGroup.creatorName : 'Unknown',
        createdAt: new Date().toISOString(),
        members: [{ id: currentUser.id, name: currentUser.name, role: 'member', status: 'online' }]
    };
    
    groups.push(newGroup);
    localStorage.setItem('groups', JSON.stringify(groups));
    
    // Update UI
    updateGroupsList();
    hideModals();
    showNotification(`Joined group "${groupName}" successfully!`, 'success');
}

// Join group tracking view
function joinGroupTracking(groupId) {
    const group = groups.find(g => g.id === groupId);
    
    if (!group) {
        showNotification('Group not found', 'error');
        return;
    }
    
    // Navigate to the tracking view with the group ID
    window.location.href = `/?group=${groupId}`;
}

// Utility function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
} 