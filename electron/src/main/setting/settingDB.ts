/* eslint-disable class-methods-use-this */
/* eslint-disable no-undef */
import path from 'node:path';
import fs from 'fs';

const RESOURCES_PATH =
  process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '../../../assets')
    : path.join(process.resourcesPath, 'assets');

const DB_FILE = path.join(RESOURCES_PATH, 'setting.json');

type TSetting = {
  character: string;
  hideOrShow: string;
};

const initSetting: TSetting = {
  character: 'hanbyul',
  hideOrShow: 'CommandOrControl+Alt+H',
};

class SettingDB {
  #setting: TSetting = initSetting;

  constructor() {
    if (!fs.existsSync(DB_FILE)) {
      this.#setting = initSetting;
      this.#save();
    } else {
      const saved = fs.readFileSync(DB_FILE, { encoding: 'utf-8', flag: 'r' });
      this.#setting = { ...this.#setting, ...JSON.parse(saved) };
    }
  }

  #save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(this.#setting));
  }

  get character() {
    return this.#setting.character;
  }

  set character(value) {
    this.#setting.character = value;
    this.#save();
  }

  get hideOrShow() {
    return this.#setting.hideOrShow;
  }

  set hideOrShow(value) {
    this.#setting.hideOrShow = value;
    this.#save();
  }
}

export default SettingDB;
