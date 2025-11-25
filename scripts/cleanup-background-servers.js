#!/usr/bin/env node

/**
 * 백그라운드 Node.js 서버 프로세스 정리
 * - 고아 프로세스 정리
 * - Claude Code 세션 보호
 * - 안전한 종료 처리
 */

const { execSync } = require('child_process');

console.log('\n🧹 백그라운드 서버 정리 중...\n');
console.log('='.repeat(50));

// 현재 프로세스 보호 목록
const currentPID = process.pid.toString();
const protectedPIDs = new Set([currentPID]);

// 부모 프로세스 찾기 (Windows 11 호환 - PowerShell 사용)
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

/**
 * Node.js 관련 프로세스 찾기 (Windows 11 호환 - WMIC 제거)
 */
function findNodeProcesses() {
  const processes = [];

  try {
    // 모든 node.exe 프로세스 찾기 (tasklist 사용 - Windows 11 호환)
    const tasklistOutput = execSync(
      'tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
    );

    // CSV 파싱: "프로세스이름","PID","세션이름","세션#","메모리"
    const lines = tasklistOutput.split('\n').filter(line => line.trim() && !line.includes('INFO:'));

    for (const line of lines) {
      const parts = line.split('","');
      if (parts.length >= 2) {
        const pid = parts[1].replace(/"/g, '').trim();

        if (pid && /^\d+$/.test(pid)) {
          // PowerShell로 명령줄 조회 (Windows 11 권장)
          let cmdLine = '';
          try {
            const psOutput = execSync(
              `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Path"`,
              { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, timeout: 3000 }
            ).trim();

            if (psOutput) {
              cmdLine = psOutput;
            }
          } catch (psErr) {
            // PowerShell 실패 시 무시
          }

          // 명령줄이 없어도 PID로 추가 (다른 방법으로 확인 가능)
          if (cmdLine || pid) {
            processes.push({ pid, cmdLine: cmdLine || 'node.exe' });
          }
        }
      }
    }
  } catch (error) {
    // 프로세스 없음 또는 tasklist 실패
  }

  return processes;
}

/**
 * 프로세스가 보호 대상인지 확인
 */
function isProtectedProcess(cmdLine) {
  const lowerCmd = cmdLine.toLowerCase();

  // Claude Code 관련 프로세스 보호
  if (lowerCmd.includes('claude') ||
      lowerCmd.includes('claudecode') ||
      lowerCmd.includes('@anthropic') ||
      lowerCmd.includes('mcp-server')) {
    return true;
  }

  // 현재 스크립트 자체 보호
  if (lowerCmd.includes('cleanup-background-servers')) {
    return true;
  }

  return false;
}

/**
 * 정리 대상 프로세스 필터링
 */
function getCleanupTargets(processes) {
  const targets = [];
  const keywords = [
    'next dev',
    'next start',
    'node_modules/next',
    'next\\dist\\bin',
    'npm run dev',
    '-p 5000'
  ];

  for (const proc of processes) {
    // 보호된 PID는 건너뜀
    if (protectedPIDs.has(proc.pid)) {
      console.log(`   ℹ️  PID ${proc.pid}: 현재 세션 (보호됨)`);
      continue;
    }

    // Claude Code 관련 프로세스 보호
    if (isProtectedProcess(proc.cmdLine)) {
      console.log(`   ℹ️  PID ${proc.pid}: Claude Code 관련 (보호됨)`);
      continue;
    }

    // 정리 대상 키워드 확인
    const lowerCmd = proc.cmdLine.toLowerCase();
    for (const keyword of keywords) {
      if (lowerCmd.includes(keyword.toLowerCase())) {
        targets.push(proc);
        break;
      }
    }
  }

  return targets;
}

// 프로세스 찾기
console.log('\n📋 Node.js 프로세스 검색 중...\n');
const allProcesses = findNodeProcesses();

if (allProcesses.length === 0) {
  console.log('✅ 실행 중인 Node.js 프로세스가 없습니다.\n');
  process.exit(0);
}

console.log(`   발견된 Node.js 프로세스: ${allProcesses.length}개\n`);

// 정리 대상 필터링
const targets = getCleanupTargets(allProcesses);

if (targets.length === 0) {
  console.log('\n✅ 정리할 백그라운드 서버가 없습니다.\n');
  process.exit(0);
}

console.log(`\n🎯 정리 대상: ${targets.length}개\n`);

// 프로세스 종료
let cleanedCount = 0;
for (const proc of targets) {
  try {
    const shortCmd = proc.cmdLine.length > 60
      ? proc.cmdLine.substring(0, 60) + '...'
      : proc.cmdLine;
    console.log(`   종료 중: PID ${proc.pid}`);
    console.log(`   명령: ${shortCmd}`);

    execSync(`taskkill /F /PID ${proc.pid}`, { stdio: 'ignore' });
    cleanedCount++;
    console.log(`   ✅ 완료\n`);
  } catch (error) {
    console.log(`   ⚠️  실패 (이미 종료되었을 수 있음)\n`);
  }
}

// 결과 출력
console.log('='.repeat(50));
if (cleanedCount > 0) {
  console.log(`\n✅ ${cleanedCount}개의 백그라운드 서버를 정리했습니다.`);
  console.log('✅ Claude Code 세션은 안전하게 유지되었습니다.\n');
} else {
  console.log('\n✅ 정리 완료 (모든 프로세스가 이미 종료되었거나 보호됨)\n');
}

process.exit(0);
