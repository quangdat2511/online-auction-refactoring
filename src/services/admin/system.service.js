import * as systemSettingModel from '../../models/systemSetting.model.js';

const DEFAULTS = {
  new_product_limit_minutes: 60,
  auto_extend_trigger_minutes: 5,
  auto_extend_duration_minutes: 10,
};

export async function getSettings() {
  const settingsArray = await systemSettingModel.getAllSettings();
  const settings = { ...DEFAULTS };
  if (settingsArray?.length > 0) {
    settingsArray.forEach(s => { settings[s.key] = parseInt(s.value); });
  }
  return settings;
}

export async function updateSettings({ new_product_limit_minutes, auto_extend_trigger_minutes, auto_extend_duration_minutes }) {
  await systemSettingModel.updateSetting('new_product_limit_minutes', new_product_limit_minutes);
  await systemSettingModel.updateSetting('auto_extend_trigger_minutes', auto_extend_trigger_minutes);
  await systemSettingModel.updateSetting('auto_extend_duration_minutes', auto_extend_duration_minutes);
}
