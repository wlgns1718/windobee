/* eslint-disable no-promise-executor-return */
import path from 'node:path';
import fs from 'fs';
import * as sqlite from 'sqlite3';
import { app } from 'electron';
import { TSubActiveMap, TSubJobTime } from './jobTime.d';

const sqlite3 = sqlite.verbose();

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../../assets');

const DB_FILE = path.join(RESOURCES_PATH, 'database.db');
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, '');
}

const TABLE_NAME = 'sub_job_time';
const dateToNumber = (date: Date) => {
  const numberDate = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return numberDate;
};

const instance = new sqlite3.Database(DB_FILE, () => {
  createTable();
});

const createTable = () => {
  instance.run(
    `CREATE TABLE IF NOT EXISTS ${TABLE_NAME}(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application TEXT,
        sub_application TEXT,
        active_time INTEGER,
        day INTEGER
      )`,
  );
};

/**
 *
 * @param {Map<string, Map<string, number>>} activeMap
 * @param {number} tickTime
 */
const insertAll = (activeMap: TSubActiveMap, tickTime: number) => {
  const now = dateToNumber(new Date());
  const activeArray: Array<TSubJobTime> = [];
  activeMap.forEach((subMap, application) => {
    subMap.forEach((tick, sub_application) => {
      activeArray.push({
        application,
        sub_application,
        active_time: tick * tickTime,
        day: now,
      });
    });
  });
  const sql = `INSERT INTO ${TABLE_NAME} (application, sub_application, active_time, day) VALUES ${activeArray
    .map(
      (active) =>
        `('${active.application}', '${active.sub_application}', ${active.active_time}, ${active.day})`,
    )
    .join(',')}`;
  instance.run(sql, () => {
    activeMap.clear();
  });
};

const combine = (
  jobs: Array<TSubJobTime>,
): Array<Pick<TSubJobTime, 'sub_application' | 'active_time'>> => {
  const combined = new Map();
  jobs.forEach((job) => {
    if (combined.has(job.sub_application)) {
      const saved = combined.get(job.sub_application);
      saved.active_time += job.active_time;
    } else {
      combined.set(job.sub_application, job);
    }
  });

  const result: Array<Pick<TSubJobTime, 'sub_application' | 'active_time'>> = [];
  combined.forEach((value) => {
    const { sub_application, active_time } = value;
    result.push({ sub_application, active_time });
  });

  return result;
};

/**
 *
 * @param { string } application application이름
 * @param { Date } day 해당 날짜
 * @returns { Array<SubJob> }
 */
const getByDay = (application: string, day: Date) => {
  const target = dateToNumber(day);

  return new Promise((resolve, reject) => {
    return instance.all(
      `SELECT sub_application, active_time, day FROM ${TABLE_NAME} WHERE day = ${target} AND application = '${application}'`,
      (err, rows) => {
        if (err) {
          return reject(err);
        }
        return resolve(combine(rows));
      },
    );
  });
};

/**
 * 오늘을 기준으로 최근 7일간의 활동 정보
 * @param { string } application application 이름
 * @returns { Array<SubJob> }
 */
const getRecentWeek = (application) => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);

  const target = dateToNumber(weekAgo);

  return new Promise((resolve, reject) => {
    return instance.all(
      `SELECT sub_application, active_time, day FROM ${TABLE_NAME} where day >= ${target} AND application = '${application}'`,
      (err, rows) => {
        if (err) {
          return reject(err);
        }
        return resolve(combine(rows));
      },
    );
  });
};

export { insertAll, getByDay, getRecentWeek };
