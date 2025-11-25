#!/usr/bin/env node

/**
 * 특정 포트를 사용하는 프로세스 종료 (v2.0)
 * - WMIC 제거 → PowerShell + tasklist 사용 (Windows 11 호환)
 * - Claude Code 세션 보호
 * - 상세한 프로세스 정보 표시
 * - TIME_WAIT 상태 감지
 */

const { execSync } = require('child_process');

const port = process.argv[2] || 5000;
const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

console.log(`\n🔍 포트 ${port}을(를) 사용하는 프로세스를 찾는 중...\n`);
console.log('='.repeat(50));

/**
 * 프로세스 이름 조회 (WMIC 대신 tasklist 사용)
 */
function getProcessInfo(pid) {
  const info = { name: 'Unknown', cmdLine: '' };

  try {
    // tasklist로 프로세스 이름 조회 (WMIC 대체)
    const tasklistOutput = execSync(
      `tasklist /FI "PID eq ${pid}" /FO CSV /NH`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
    ).trim();

    if (tasklistOutput && !tasklistOutput.includes('INFO:')) {
      // CSV 형식: "프로세스이름","PID","세션이름","세션#","메모리사용량"
      const parts = tasklistOutput.split('","');
      if (parts.length >= 1) {
        info.name = parts[0].replace(/^"/, '').replace(/"$/, '');
      }
    }

    // PowerShell로 명령줄 조회 (Windows 11 권장 방식)
    try {
      const psOutput = execSync(
        `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Path"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, timeout: 3000 }
      ).trim();

      if (psOutput) {
        info.cmdLine = psOutput;
      }
    } catch (psError) {
      // PowerShell 실패 시 무시 (프로세스가 이미 종료되었을 수 있음)
    }

  } catch (error) {
    // 프로세스가 이미 종료되었거나 접근 권한 없음
  }

  return info;
}

/**
 * 포트 상태 분석
 */
function analyzePortStatus() {
  const result = {
    listening: [],   // LISTENING 상태 (종료 대상)
    timeWait: 0,     // TIME_WAIT 상태 (대기 필요)
    closeWait: 0,    // CLOSE_WAIT 상태
    established: 0   // ESTABLISHED 상태
  };

  try {
    const output = execSync(`netstat -ano | findstr ":${port}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const localAddress = parts[1];
        const state = parts[3];
        const pid = parts[4];

        // 정확한 포트 매칭
        if (localAddress.endsWith(`:${port}`)) {
          if (state === 'LISTENING' && pid && /^\d+$/.test(pid) && pid !== '0') {
            result.listening.push(pid);
          } else if (state === 'TIME_WAIT') {
            result.timeWait++;
          } else if (state === 'CLOSE_WAIT') {
            result.closeWait++;
          } else if (state === 'ESTABLISHED') {
            result.established++;
          }
        }
      }
    }
  } catch (error) {
    // 포트를 사용하는 프로세스 없음
  }

  return result;
}

/**
 * Claude Code 관련 프로세스인지 확인
 */
function isClaudeProcess(info) {
  const combined = `${info.name} ${info.cmdLine}`.toLowerCase();
  return combined.includes('claude') ||
         combined.includes('claudecode') ||
         combined.includes('@anthropic') ||
         combined.includes('mcp-server');
}

// 현재 프로세스와 부모 프로세스 보호
const currentPID = process.pid.toString();
const protectedPIDs = new Set([currentPID]);

try {
  const ppidOutput = execSync(
    `powershell -NoProfile -Command "(Get-Process -Id $PID).Parent.Id"`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
  ).trim();
  if (ppidOutput && /^\d+$/.test(ppidOutput)) {
    protectedPIDs.add(ppidOutput);
  }
} catch (error) {
  // 부모 프로세스 확인 실패
}

// 포트 상태 분석
const status = analyzePortStatus();

// 상태 출력
console.log('\n📊 포트 상태 요약:\n');

if (status.listening.length === 0 && status.timeWait === 0 && status.closeWait === 0) {
  console.log(`   ✅ 포트 ${port}: 사용 가능 (FREE)\n`);
  console.log('='.repeat(50));
  console.log('\n💡 서버를 바로 시작할 수 있습니다.\n');
  process.exit(0);
}

if (status.listening.length > 0) {
  console.log(`   🔴 LISTENING: ${status.listening.length}개 프로세스 (종료 대상)`);
}
if (status.timeWait > 0) {
  console.log(`   ⏳ TIME_WAIT: ${status.timeWait}개 연결 (60-120초 후 자동 해제)`);
}
if (status.closeWait > 0) {
  console.log(`   ⚠️  CLOSE_WAIT: ${status.closeWait}개 연결`);
}
if (status.established > 0) {
  console.log(`   🔗 ESTABLISHED: ${status.established}개 활성 연결`);
}

// LISTENING 프로세스 종료
if (status.listening.length === 0) {
  console.log('\n⚠️  종료할 LISTENING 프로세스가 없습니다.');

  if (status.timeWait > 0) {
    console.log(`\n💡 TIME_WAIT 상태가 있습니다. 잠시 후 자동으로 해제됩니다.`);
    console.log('   또는 다른 포트 사용: npm run dev -- -p 5001');
  }

  console.log('\n' + '='.repeat(50) + '\n');
  process.exit(0);
}

console.log('\n📋 프로세스 종료 중...\n');

let killedCount = 0;
let protectedCount = 0;

const uniquePIDs = [...new Set(status.listening)];

for (const pid of uniquePIDs) {
  // 현재 프로세스 및 부모 프로세스 보호
  if (protectedPIDs.has(pid)) {
    console.log(`   ℹ️  PID ${pid}: 현재 세션 (보호됨)`);
    protectedCount++;
    continue;
  }

  const info = getProcessInfo(pid);

  if (verbose) {
    console.log(`   📍 PID ${pid}: ${info.name}`);
    if (info.cmdLine) {
      const shortCmd = info.cmdLine.length > 60
        ? info.cmdLine.substring(0, 60) + '...'
        : info.cmdLine;
      console.log(`      경로: ${shortCmd}`);
    }
  }

  // Claude Code 관련 프로세스 보호
  if (isClaudeProcess(info)) {
    console.log(`   ⚠️  PID ${pid}: Claude Code 관련 (보호됨)`);
    protectedCount++;
    continue;
  }

  // 프로세스 종료
  try {
    if (!verbose) {
      console.log(`   종료 중: PID ${pid} (${info.name})`);
    }
    execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', windowsHide: true });
    console.log(`   ✅ PID ${pid} 종료됨`);
    killedCount++;
  } catch (error) {
    console.log(`   ⚠️  PID ${pid} 종료 실패 (이미 종료됨)`);
  }
}

// 결과 출력
console.log('\n' + '='.repeat(50));

if (killedCount === 0) {
  if (protectedCount > 0) {
    console.log(`\n⚠️  모든 프로세스가 보호되었습니다 (${protectedCount}개).`);
    console.log('   Claude Code 세션은 안전하게 유지됩니다.\n');
  } else {
    console.log(`\n⚠️  종료된 프로세스가 없습니다.\n`);
  }
} else {
  console.log(`\n✅ ${killedCount}개의 프로세스를 종료했습니다.`);

  if (protectedCount > 0) {
    console.log(`ℹ️  ${protectedCount}개의 프로세스가 보호되었습니다.`);
  }

  if (status.timeWait > 0) {
    console.log(`\n⏳ 참고: TIME_WAIT 상태(${status.timeWait}개)는 OS가 자동으로 해제합니다.`);
    console.log('   즉시 시작하려면: npm run dev:safe (자동 대기 포함)');
  } else {
    console.log(`\n✅ 포트 ${port}이(가) 해제되었습니다.`);
  }

  console.log('✅ Claude Code 세션은 안전하게 유지되었습니다.\n');
}

// 종료 코드: 0=성공, 1=실패
process.exit(killedCount > 0 || status.listening.length === 0 ? 0 : 1);
