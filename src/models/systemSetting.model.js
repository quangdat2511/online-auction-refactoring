import db from '../utils/db.js';

export function getAllSettings() {
    return db('system_settings').select('*');
}

export function getSettings() {
    return db('system_settings').first();
}

export function getSetting(key) {
    return db('system_settings')
        .where({ key })
        .first();
}

export function updateSetting(key, value) {
    return db('system_settings')
        .update({ value })
        .where({ key });
}

export function editNewProductLimitMinutes(minutes) {
    return db('system_settings')
        .update({ value: minutes })
        .where({ key: 'new_product_limit_minutes' });
}