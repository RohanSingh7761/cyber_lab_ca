const crypto = require('crypto');

// Generate secure random token
const generateToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

// Generate invitation token
const generateInvitationToken = () => {
    return generateToken(24);
};

module.exports = {
    generateToken,
    generateInvitationToken
};
