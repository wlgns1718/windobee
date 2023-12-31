/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import naver from '../../../../assets/naver.png';
import daum from '../../../../assets/daum.png';
import * as S from './Mail.style';
import Time from './Time';
import TMail from './TMail';

function MailBox({
  mails,
  setMails,
}: {
  mails: TMail[];
  setMails: React.Dispatch<React.SetStateAction<TMail[]>>;
}) {
  const navigate = useNavigate();

  return (
    <>
      {mails
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((mail) => {
          let img;
          switch (mail.host) {
            case 'imap.naver.com':
              img = naver;
              break;
            case 'imap.daum.net':
              img = daum;
              break;
          }

          return (
            <S.Wrapper key={mail.seq}>
              <S.MailWrapper>
                <S.Icon src={img} />
                <S.Contents>
                  <S.ContentsDiv>
                    <S.Sender>{mail.from}</S.Sender>
                    <Time
                      onClick={() => {
                        window.electron.ipcRenderer.sendMessage(
                          'deleteMail',
                          mail,
                        );
                        setMails((prevMails) =>
                          prevMails.filter((m) => m.seq !== mail.seq),
                        );
                      }}
                      time={mail.date}
                    />
                  </S.ContentsDiv>
                  <S.Title
                    onClick={() => {
                      navigate('/mailContent', { state: { mail } });
                    }}
                  >
                    <S.Text>{mail.subject}</S.Text>
                  </S.Title>
                </S.Contents>
              </S.MailWrapper>
            </S.Wrapper>
          );
        })}
    </>
  );
}

export default MailBox;
