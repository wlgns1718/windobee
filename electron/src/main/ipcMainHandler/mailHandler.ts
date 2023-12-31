import { BrowserWindow, app, ipcMain } from 'electron';
import path from 'path';
import { resolveHtmlPath } from '../util';
import { mainWindow, subWindow, mainVariables } from '../windows';
import { getMails, checkMail } from '../mail/mail';
import { dbInstance } from '../mail/emailDB';

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const fs = require('fs');

const receivedList: Array<Map<string, Array<any>>> = [];
// const received: [] = []; // 새로운 메일 수신 확인을 위해 임시로 저장하는 배열
const mails: Array<TMail> = []; // 이제껏 수신한 메일들을 보관하는 배열
let mailAddress: string | null = null;
let mailPassword: string | null = null;
let mailHost: string | null = null;
let mailPort: number | null = null;
let mailSecure: boolean | null = null;

type TMail = {
  seq: number;
  from: string;
  to: string;
  subject: string;
  host: string;
  content: string;
};

// DB 실행
dbInstance.init();
dbInstance.createTable();

const mailHandler = () => {
  mailRequestHandler();
  deleteMailHandler();
  mailSendHandler();
  mailReceiveHandler();
  chartReceivingHadler();
  accountSaveHandler();
  accountRequestHandler();
  accountDeleteHandler();
  reportSendHandler();
};

/**
 * 'mailRequest' : 메일 리퀘스트
 */
const mailRequestHandler = () => {
  ipcMain.on('mailRequest', () => {
    subWindow.webContents.send('mailRequest', mails);
  });
};

/**
 * 'deleteMail : 메일 삭제
 */
const deleteMailHandler = () => {
  ipcMain.on('deleteMail', (_event, mail) => {
    for (let i = 0; i < mails.length; ++i) {
      if (
        mails[i].seq === mail.seq &&
        mails[i].to === mail.to &&
        mails[i].host === mail.host
      ) {
        // 해당 메일 삭제
        mails.splice(i, 1);
        return;
      }
    }
  });
};

/**
 * 일정시간마다 메일 보내기
 */
const mailSendHandler = async () => {
  const accounts = await dbInstance.getAll();
  if (accounts.length > 0) {
    mailAddress = accounts[0].id;
    mailPassword = accounts[0].password;

    if (accounts[0].host === 'imap.naver.com') {
      mailHost = 'smtp.naver.com';
      mailPort = 587;
      mailSecure = false;
    } else if (accounts[0].host === 'imap.daum.net') {
      mailHost = 'smtp.daum.net';
      mailPort = 465;
      mailSecure = true;
    }

    const transporter = nodemailer.createTransport({
      host: mailHost,
      secure: mailSecure, // 다른 포트를 사용해야 되면 false값을 주어야 합니다.
      port: mailPort, // 다른 포트를 사용시 여기에 해당 값을 주어야 합니다.
      auth: {
        user: mailAddress,
        pass: mailPassword,
      },
    });
    const RESOURCES_PATH = app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '../../../assets');

    cron.schedule(`10 * * * * `, async () => {
      const FILE = path.join(RESOURCES_PATH, 'report.png'); // assets 폴더에 레포트 저장하고 맞춰주면 된다.
      const account = `${mailAddress}@${
        accounts[0].host === 'imap.naver.com' ? 'naver.com' : 'daum.net'
      }`;
      try {
        transporter.sendMail({
          from: account,
          to: account,
          subject: `${new Date().toLocaleString()} 보고서 입니다.`, // 제목
          text: '이번주 보고서 입니다(by windobi)', // 내용
          attachments: [
            { filename: 'report.png', content: fs.createReadStream(FILE) },
          ],
        });
      } catch (error) {
        /* empty */
      }

      // 5시마다 보고서 보내기
    });
  }
};

/**
 * 일정시간마다 메일 받아오기
 */
const mailReceiveHandler = async () => {
  const accounts = await dbInstance.getAll();
  for (let i = 0; i < accounts.length; ++i) {
    const name =
      accounts[i].id +
      (accounts[i].host === 'imap.naver.com' ? 'naver.com' : 'daum.net');
    const received = {};
    received.name = name;
    received.array = [];
    receivedList.push(received);
    const timerId: IntervalId = setInterval(
      getMails,
      10000,
      mainWindow,
      subWindow,
      receivedList,
      mails,
      accounts[i].id,
      accounts[i].password,
      accounts[i].host,
    );
    const timer = {};
    timer.key = name;
    timer.timerId = timerId;
    mainVariables.mailListners.push(timer);
    await setTimeout(() => {}, 1000);
  }
};

const addMailListener = (id: string, password: string, host: string) => {
  const n = id + (host === 'imap.naver.com' ? 'naver.com' : 'daum.net');
  const received = {};
  received.name = n;
  received.array = [];
  receivedList.push(received);
  const timerId: IntervalId = setInterval(
    getMails,
    10000,
    mainWindow,
    subWindow,
    receivedList,
    mails,
    id,
    password,
    host,
  );
  const timer = {};
  const name = id + (host === 'imap.naver.com' ? 'naver.com' : 'daum.net');
  timer.key = name;
  timer.timerId = timerId;
  mainVariables.mailListners.push(timer);
};

/**
 * 'chartReceivingHadler : 차트 이미지 수신
 */
const chartReceivingHadler = () => {
  ipcMain.on('chartChannel', (_event, chart) => {
    // 차트 이미지 수신
    // 이미지 저장하기
    const RESOURCES_PATH = app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '../../../assets');
    const FILE = path.join(RESOURCES_PATH, 'report.png');
    const dataUrl = chart.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const buffer = Buffer.from(dataUrl[2], 'base64');
    fs.writeFile(FILE, buffer, (e: any) => {
      if (!e) {
        // File is Empty
        /* empty */
      }
    });
  });
};

/**
 * 'accountSaveHandler : 이메일 계정 저장 핸들러
 */
const accountSaveHandler = () => {
  ipcMain.on('accountSave', async (_event, email) => {
    // 이메일 계정 Sqlite3에서 불러오기
    // 중복체크
    const res = await dbInstance.getAccountByIdAndHost(email.id, email.host);
    if (res.length > 0) {
      _event.sender.send('accountSave', {
        code: '400',
        content: 'duplicateError',
      });
      return;
    }

    ipcMain.on('connectSuccess', () => {
      // 연결이 성공한 경우
      _event.sender.send('accountSave', { code: '200', content: 'success' });
      ipcMain.removeAllListeners('connectSuccess');
      dbInstance.insert(email);
      addMailListener(email.id, email.password, email.host);
    });
    ipcMain.on('connectFail', () => {
      // 연결이 실패한 경우 인증오류!
      _event.sender.send('accountSave', {
        code: '401',
        content: 'authentication error',
      });
      ipcMain.removeAllListeners('connectFail');
    });
    // imap을 통해 접속확인
    checkMail(email.id, email.password, email.host);
  });
};

/**
 * 'accountRequestHandler : 이메일 계정 정보 요청 핸들러
 */

const accountRequestHandler = () => {
  ipcMain.handle('accountRequest', async () => {
    // 이메일 계정 Sqlite3에서 불러오기
    // 이메일만 보내주기
    const result = await dbInstance.getAll();
    return result;
  });
};

/**
 * 'accountDeleteHandler : 이메일 계정 삭제 요청 핸들러
 */

const accountDeleteHandler = () => {
  ipcMain.on('accountDelete', (_event, email) => {
    // 이메일 계정 삭제
    dbInstance.deleteByIdAndHost(email.id, email.host);
    const name =
      email.id + (email.host === 'imap.naver.com' ? 'naver.com' : 'daum.net');
    const timer = mainVariables.mailListners.filter((m) => m.key === name);
    // 기존에 실행중이던 이메일 리스너 끄기
    clearInterval(timer[0].timerId);
  });
};

/**
 * 'test' : 보고서 테스트
 */
const reportSendHandler = () => {
  setTimeout(async () => {
    const chartWindow = new BrowserWindow({
      width: 1500,
      height: 800,
      show: false,
      transparent: false,
      focusable: false,
      frame: false,
      webPreferences: {
        preload: app.isPackaged
          ? path.join(__dirname, 'preload.js')
          : path.join(__dirname, '../../../.erb/dll/preload.js'),
      },
    });
    await chartWindow.loadURL(resolveHtmlPath('index.html'));
    chartWindow.webContents.send('sub', 'createchart');
    chartWindow.webContents.closeDevTools();
  }, 5000);
};

export default mailHandler;
