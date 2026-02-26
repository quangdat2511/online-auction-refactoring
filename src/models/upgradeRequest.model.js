import db from '../utils/db.js';

export function findByUserId(bidderId) {
  return db('upgrade_requests').where('bidder_id', bidderId).first();
}
export function createUpgradeRequest(bidderId) {
  return db('upgrade_requests').insert({
    bidder_id: bidderId,
  });
}
export function loadAllUpgradeRequests() {
  return db('upgrade_requests')
    .join('users', 'upgrade_requests.bidder_id', 'users.id')
    .select('upgrade_requests.*', 'users.fullname as fullname', 'users.email as email')
    .orderBy('upgrade_requests.created_at', 'desc'); // Sắp xếp mới nhất lên đầu
}
export function approveUpgradeRequest(requestId) {
    return db('upgrade_requests')
        .where('id', requestId)
        .update({ 
            status: 'approved', 
            updated_at: new Date() 
        });
}
export function rejectUpgradeRequest(requestId, admin_note) {
    return db('upgrade_requests')
        .where('id', requestId)
        .update({ 
            status: 'rejected', 
            admin_note: admin_note, 
            updated_at: new Date() 
        });
}