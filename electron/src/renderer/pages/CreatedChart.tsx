import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveTimeRange } from '@nivo/calendar';
import * as S from '../components/report/Report.style';
import RecentApplication from '../components/jobtime/RecentApplication';
import PieChart from '../components/jobtime/PieChart';

type Data = {
  day: number;
  time: number;
};

type DataOfDev = {
  day: number;
  active_time: number;
};

interface ModifiedData {
  day: string;
  value: number;
}

function CreatedChart() {
  const { state } = useLocation();
  const [_dummy, setDummy] = useState<string>('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      if (ref.current === null) return;
      toPng(ref.current, { cacheBust: true }).then((dataUrl) => {
        window.electron.ipcRenderer.sendMessage('chartChannel', dataUrl);
      });
    }, 3000);
  }, []);

  const result: Array<Data> = state.weeklyJobs;
  const lastWeek: Array<Data> = state.lastWeekAvg;
  const { entireDevAmt } = state;

  const modifiedData: ModifiedData[] = entireDevAmt.map((item) => {
    const dateString = item.day.toString();
    const formattedDate = `${dateString.slice(0, 4)}-${dateString.slice(
      4,
      6,
    )}-${dateString.slice(6, 8)}`;

    return {
      day: formattedDate,
      value: Math.floor(item.active_time / 60),
    };
  });

  /**
   * 개발 잔디 표현구간 설정(from ~ to)
   */
  let from = new Date();
  let to = new Date();
  from.setDate(from.getDate() - 90);

  from = `${from.getFullYear()}-${(from.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${from.getDate().toString().padStart(2, '0')}`;

  to = `${to.getFullYear()}-${(to.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${to.getDate().toString().padStart(2, '0')}`;

  /**
   * 이번주 가장 많이 사용한 시간
   */
  // let { day: highestDay, time: highestTime } = result.reduce(
  //   (max, current) => (current.time > max.time ? current : max),
  //   result[0],
  // );
  // const highestHour = Math.floor(highestTime, 0);
  // const highestMin = Math.floor((highestTime % 1) * 60, 0);

  // 이번주 사용시간
  const timeSum: number = result.reduce((sum, data) => sum + data.time, 0); // 이번주 사용시간 (시간단위 2.3 혹은 3.4 )
  const timeAvg: number = timeSum / 7; // 이번주 사용시간 평균
  const timeAvgHour: number = Math.floor(timeAvg, 0); // 이번주 사용시간 평균 (시)
  const timeAvgMin: number = Math.floor((timeAvg % 1) * 60, 0); // 이번주 사용시간 평균 (분)

  // 지난주 사용시간 합
  const lastTimeSum = lastWeek[0].time; // 시간단위 2.3 혹은 3.4

  // 이번주와 지난주 비교
  const sumDiff = timeSum - lastTimeSum; // 양수 : 더 많이 사용, 음수 : 덜 사용

  const sumAbsDiff = Math.abs(sumDiff);
  const sumAbsDiffHour: number = Math.floor(sumAbsDiff, 0);
  const sumAbsDiffMin: number = Math.floor((sumAbsDiff % 1) * 60, 0);

  return (
    <div
      ref={ref}
      style={{
        width: '100%',
        height: '100%',
        background: '#F6F6F8',
        overflow: 'scroll',
      }}
    >
      {/* <BarChart
        dailyJobs={[]}
        weeklyJobs={state.weeklyJobs}
        setApplication={setDummy}
        type="weekly"
      /> */}
      {/* {result.map((item, index) => (
        <div key={index}>{JSON.stringify(item)}</div>
      ))} */}

      <S.Title>주간 리포트</S.Title>
      <S.Date>
        {result[0].day} - {result[result.length - 1].day}
      </S.Date>
      <S.Body>
        <div>
          <S.BarContainer>
            <S.BarHeader>
              <S.Bolder>{timeAvgHour}</S.Bolder>
              <p style={{ marginRight: '5px' }}>시간</p>{' '}
              <S.Bolder> {timeAvgMin}</S.Bolder>분
            </S.BarHeader>
            <S.Lighter>하루 평균 사용시간</S.Lighter>

            <ResponsiveBar
              markers={[
                {
                  axis: 'y',
                  value: timeAvg,
                  legend: '평균',
                  lineStyle: {
                    stroke: 'red',
                  },
                  textStyle: {
                    fill: 'red',
                  },
                },
              ]}
              data={result}
              keys={['time']}
              indexBy="day"
              margin={{ top: 50, right: 40, bottom: 100, left: 40 }}
              padding={0.7}
              valueScale={{ type: 'linear' }}
              indexScale={{ type: 'band', round: true }}
              colors={['#2694F5']}
              enableLabel={false}
              borderColor={{
                from: 'color',
                modifiers: [['darker', 1.6]],
              }}
              borderRadius="10px"
              axisTop={null}
              axisRight={null}
              labelSkipWidth={12}
              labelSkipHeight={12}
              labelTextColor={{
                from: 'color',
                modifiers: [['darker', 1.6]],
              }}
              role="application"
              ariaLabel="Nivo bar chart demo"
            />
          </S.BarContainer>

          <S.LastWeekContainer>
            지난주 보다&nbsp;
            <S.LastWeekHeader>
              <S.Bolder> {sumAbsDiffHour}</S.Bolder>시간{' '}
              <S.Bolder> {sumAbsDiffMin} </S.Bolder>분&nbsp;
            </S.LastWeekHeader>
            {sumDiff < 0 ? (
              <p>
                {' '}
                <b>덜</b> 사용 했습니다
              </p>
            ) : (
              <p>
                {' '}
                <b>더</b> 사용 했습니다
              </p>
            )}
          </S.LastWeekContainer>

          <S.MostAppContainer>
            <S.MostTitle>많이 사용한 앱</S.MostTitle>
            <RecentApplication />
          </S.MostAppContainer>
        </div>
        <S.MostDetailContainer>
          <S.MostLangTitle>사용 언어</S.MostLangTitle>
          <PieChart
            application="Visual Studio Code"
            day={new Date()}
            type="weekly"
          />
        </S.MostDetailContainer>

        <div style={{ height: '600px' }}>
          <S.GrassContainer>
            <S.MostLangTitle>개발 잔디 (단위 : 분)</S.MostLangTitle>
            <ResponsiveTimeRange
              dayRadius={5}
              data={modifiedData}
              from={from}
              to={to}
              emptyColor="#eeeeee"
              colors={['#b4d9fa', '#8ec8fa', '#51acfc', '#2694f5']}
              margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
              dayBorderWidth={2}
              dayBorderColor="#ffffff"
              legends={[
                {
                  anchor: 'bottom-right',
                  direction: 'row',
                  justify: false,
                  itemCount: 4,
                  itemWidth: 59,
                  itemHeight: 50,
                  itemsSpacing: 26,
                  itemDirection: 'right-to-left',
                  translateX: -70,
                  translateY: -70,
                  symbolSize: 23,
                },
              ]}
            />
          </S.GrassContainer>
          <S.UsageByTimeContainer></S.UsageByTimeContainer>
        </div>
      </S.Body>
    </div>
  );
}

export default CreatedChart;
