#!/usr/bin/env node

/**
 * Windows 최적화 Next.js 개발 서버 시작 (v2.0)
 * - TIME_WAIT 상태 감지 및 대기
 * - 포트 해제 확인 후에만 서버 시작
 * - 재시도 메커니즘 (최대 3회)
 * - Claude Code 세션 보호
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const PORT = 5000;
const MAX_RETRIES = 3;
const PORT_WAIT_TIMEOUT = 15000; // 15초 (TIME_WAIT 대기)
const PORT_CHECK_INTERVAL = 1000; // 1초마다 확인

console.log('🚀 Windows 최적화 개발 서버 시작 (v2.0)\n');
console.log('='.repeat(50));

/**
 * 포트 상태 확인
 * @returns {{ inUse: boolean, listening: boolean, timeWait: boolean, pids: string[] }}
 */
function checkPortStatus() {
  const result = {
    inUse: false,
    listening: false,
    timeWait: false,
    closeWait: false,
    pids: []
  };

  try {
    const output = execSync(`netstat -ano | findstr ":${PORT}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    const lines = output.split('\n').filter(line => line.trim());
    const pids = new Set();

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const localAddress = parts[1];
        const state = parts[3];
        const pid = parts[4];

        // 정확한 포트 매칭
        if (localAddress.endsWith(`:${PORT}`)) {
          result.inUse = true;

          if (state === 'LISTENING') {
            result.listening = true;
            if (pid && /^\d+$/.test(pid) && pid !== '0') {
              pids.add(pid);
            }
          } else if (state === 'TIME_WAIT') {
            result.timeWait = true;
          } else if (state === 'CLOSE_WAIT') {
            result.closeWait = true;
          }
        }
      }
    }

    result.pids = Array.from(pids);
  } catch (error) {
    // 포트 사용 프로세스 없음 (정상)
  }

  return result;
}

/**
 * 프로세스가 Claude Code 세션인지 확인
 */
function isClaudeCodeProcess(cmdLine) {
  if (!cmdLine) return false;
  const lowerCmd = cmdLine.toLowerCase();
  return lowerCmd.includes('claude') ||
         lowerCmd.includes('claudecode') ||
         lowerCmd.includes('@anthropic') ||
         lowerCmd.includes('mcp-server');
}

/**
 * 포트 프로세스 종료 (Claude Code 보호)
 */
function killPortProcesses(pids) {
  const currentPID = process.pid.toString();
  let parentPID = null;

  // 부모 프로세스 확인 (Windows 11 호환 - PowerShell 사용)
  try {
    const ppidOutput = execSync(
      `powershell -NoProfile -Command "(Get-Process -Id ${currentPID} -ErrorAction SilentlyContinue).Parent.Id"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
    ).trim();
    if (ppidOutput && /^\d+$/.test(ppidOutput)) {
      parentPID = ppidOutput;
    }
  } catch (error) {
    // 부모 프로세스 확인 실패
  }

  let killedCount = 0;
  for (const pid of pids) {
    // 현재 프로세스나 부모 프로세스는 보호
    if (pid === currentPID || pid === parentPID) {
      console.log(`   ℹ️  PID ${pid}: 현재 세션 (보호됨)`);
      continue;
    }

    // Claude Code 관련 프로세스 확인 (Windows 11 호환 - PowerShell 사용)
    try {
      const psOutput = execSync(
        `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Path"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, timeout: 3000 }
      ).trim();

      if (psOutput && isClaudeCodeProcess(psOutput)) {
        console.log(`   ℹ️  PID ${pid}: Claude Code 관련 (보호됨)`);
        continue;
      }
    } catch (error) {
      // 프로세스 정보 조회 실패 - 이미 종료되었을 수 있음
    }

    // 프로세스 종료
    try {
      execSync(`taskkill /F /PID ${pid}`, {
        stdio: 'ignore',
        windowsHide: true
      });
      console.log(`   ✅ PID ${pid} 종료됨`);
      killedCount++;
    } catch (error) {
      console.log(`   ⚠️  PID ${pid} 종료 실패 (이미 종료됨)`);
    }
  }

  return killedCount;
}

/**
 * 포트가 해제될 때까지 대기
 * @returns {Promise<boolean>} 포트 사용 가능 여부
 */
async function waitForPortRelease() {
  const startTime = Date.now();

  while (Date.now() - startTime < PORT_WAIT_TIMEOUT) {
    const status = checkPortStatus();

    if (!status.inUse) {
      return true; // 포트 사용 가능
    }

    if (status.listening) {
      console.log(`   ⚠️  LISTENING 프로세스 발견: ${status.pids.join(', ')}`);
      const killed = killPortProcesses(status.pids);
      if (killed > 0) {
        // 프로세스 종료 후 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
    }

    if (status.timeWait) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining = Math.round((PORT_WAIT_TIMEOUT - (Date.now() - startTime)) / 1000);
      process.stdout.write(`\r   ⏳ TIME_WAIT 대기 중... (${elapsed}초 경과, 최대 ${remaining}초 남음)  `);
    }

    await new Promise(resolve => setTimeout(resolve, PORT_CHECK_INTERVAL));
  }

  // 타임아웃
  const status = checkPortStatus();
  return !status.listening; // TIME_WAIT만 남아있으면 강제 시작 시도
}

/**
 * Next.js 프로세스 정리
 */
function cleanupNextjsProcesses() {
  try {
    execSync('node scripts/kill-nextjs-only.js', {
      cwd: projectRoot,
      stdio: 'inherit'
    });
  } catch (error) {
    console.log('⚠️  프로세스 정리 중 오류 발생 (무시하고 계속 진행)');
  }
}

/**
 * .next 디렉토리 정리
 */
function cleanupNextDir() {
  const nextDir = path.join(projectRoot, '.next');
  if (fs.existsSync(nextDir)) {
    try {
      execSync(`rmdir /s /q "${nextDir}"`, { stdio: 'inherit' });
      console.log('✅ .next 디렉토리 정리 완료');
    } catch (error) {
      console.log('⚠️  .next 디렉토리 정리 실패 (무시하고 계속 진행)');
    }
  } else {
    console.log('✅ .next 디렉토리 없음 (스킵)');
  }
}

/**
 * 개발 서버 시작
 */
function startServer() {
  console.log('\n📋 서버 시작 중...');
  console.log('='.repeat(50));
  console.log('\n🌐 서버 주소: http://localhost:5000');
  console.log('🌐 네트워크: http://0.0.0.0:5000');
  console.log('\n✨ 개발 서버가 시작되었습니다!\n');
  console.log('='.repeat(50) + '\n');

  const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  const devProcess = spawn('node', [nextBin, 'dev', '-p', `${PORT}`, '-H', '0.0.0.0'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false
  });

  devProcess.on('error', (error) => {
    console.error('\n❌ 개발 서버 시작 실패:', error.message);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    console.log('\n\n👋 개발 서버를 종료합니다...');
    devProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n👋 개발 서버를 종료합니다...');
    devProcess.kill('SIGTERM');
    process.exit(0);
  });

  devProcess.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`\n⚠️  개발 서버가 코드 ${code}로 종료되었습니다.`);
    }
    process.exit(code || 0);
  });
}

/**
 * 재시도 로직이 포함된 메인 시작 함수
 */
async function attemptStart(attempt = 1) {
  console.log(`\n🔄 시작 시도 ${attempt}/${MAX_RETRIES}`);
  console.log('-'.repeat(40));

  // 1단계: 기존 Next.js 프로세스 정리
  console.log('\n📋 1단계: 기존 Next.js 프로세스 정리 중...');
  cleanupNextjsProcesses();

  // 2단계: .next 디렉토리 정리
  console.log('\n📋 2단계: .next 디렉토리 정리 중...');
  cleanupNextDir();

  // 3단계: 포트 상태 확인 및 대기
  console.log(`\n📋 3단계: 포트 ${PORT} 상태 확인 중...`);
  const initialStatus = checkPortStatus();

  if (initialStatus.inUse) {
    if (initialStatus.listening) {
      console.log(`   🔴 포트 ${PORT}: LISTENING 프로세스 발견`);
      killPortProcesses(initialStatus.pids);
    }
    if (initialStatus.timeWait) {
      console.log(`   ⏳ 포트 ${PORT}: TIME_WAIT 상태 (OS가 포트 해제 대기 중)`);
    }
    if (initialStatus.closeWait) {
      console.log(`   ⚠️  포트 ${PORT}: CLOSE_WAIT 상태`);
    }

    console.log('\n📋 4단계: 포트 해제 대기 중...');
    const portAvailable = await waitForPortRelease();
    console.log(''); // 줄바꿈 (TIME_WAIT 카운터 후)

    if (!portAvailable) {
      const finalStatus = checkPortStatus();
      if (finalStatus.listening) {
        console.log(`\n❌ 포트 ${PORT}을 해제할 수 없습니다.`);

        if (attempt < MAX_RETRIES) {
          console.log(`\n⏳ ${5}초 후 재시도합니다...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          return attemptStart(attempt + 1);
        } else {
          console.log('\n❌ 최대 재시도 횟수 초과');
          console.log('\n💡 해결 방법:');
          console.log('   1. npm run port:kill  (포트 강제 종료)');
          console.log('   2. npm run restart    (완전 재시작)');
          console.log('   3. 다른 포트 사용: npm run dev -- -p 5001');
          process.exit(1);
        }
      } else {
        // TIME_WAIT만 남아있으면 강제 시작 시도
        console.log('   ⚠️  TIME_WAIT만 남음 - 서버 시작 시도');
      }
    } else {
      console.log(`   ✅ 포트 ${PORT} 사용 가능`);
    }
  } else {
    console.log(`   ✅ 포트 ${PORT} 사용 가능`);
  }

  // 5단계: 서버 시작
  console.log('\n📋 5단계: Next.js 개발 서버 시작');
  startServer();
}

// 메인 실행
attemptStart().catch(error => {
  console.error('\n❌ 예기치 않은 오류:', error);
  process.exit(1);
});
