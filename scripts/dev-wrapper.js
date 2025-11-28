/**
 * Development Server Wrapper Script
 * Filters Windows file lock errors silently
 */

const { spawn } = require('child_process');
const isWindows = process.platform === 'win32';

// 필터링할 에러 패턴 (Windows 파일 잠금 관련)
const errorPatterns = [
  /UNKNOWN: unknown error, open.*\.next[\/\\]static[\/\\]chunks/i,
  /errno: -4094/i,
  /code: 'UNKNOWN'/i,
  /syscall: 'open'/i,
  /path:.*\.next[\/\\]static[\/\\]chunks/i,
  /Error: UNKNOWN: unknown error/i,
  /\[Error: UNKNOWN: unknown error/i,
];

// 에러 메시지가 필터링되어야 하는지 확인
function shouldFilterError(line) {
  if (!isWindows) return false;
  
  // .next 폴더의 파일 잠금 관련 모든 에러 필터링
  if (/\.next[\/\\]static[\/\\]chunks/i.test(line)) {
    return true;
  }
  
  return errorPatterns.some(pattern => pattern.test(line));
}

// 에러 블록 추적 (여러 줄에 걸친 에러)
let isInErrorBlock = false;
let errorBlockLines = [];
const MAX_BLOCK_LINES = 10; // 최대 추적할 줄 수

// Next.js dev 서버 시작
console.log('[INFO] Starting Next.js development server...');
console.log('[INFO] Windows file lock errors will be filtered automatically.\n');

const nextDev = spawn('npx', ['next', 'dev', '-p', '5000', '-H', '0.0.0.0'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: isWindows,
  env: {
    ...process.env,
    // Next.js에게 개발 모드임을 명시
    NODE_ENV: 'development',
  },
});

let filteredErrorCount = 0;
const maxFilteredErrorsToLog = 1; // 처음 한 번만 로그

// stdout 처리 (일반 로그는 그대로 출력, 에러 패턴은 필터링)
nextDev.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // stdout에도 에러 메시지가 섞여 있을 수 있으므로 필터링
    if (shouldFilterError(trimmed)) {
      // 필터링 (출력하지 않음)
      return;
    }
    
    process.stdout.write(line + '\n');
  });
});

// stderr 처리 (에러 필터링)
nextDev.stderr.on('data', (data) => {
  const lines = data.toString().split('\n');
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      // 빈 줄은 에러 블록 종료 신호로 간주
      if (isInErrorBlock && errorBlockLines.length > 0) {
        // 에러 블록 완료, 필터링된 것으로 카운트
        filteredErrorCount++;
        errorBlockLines = [];
        isInErrorBlock = false;
        
        // 처음 한 번만 로그 출력
        if (filteredErrorCount === maxFilteredErrorsToLog) {
          console.warn('[INFO] Windows file lock errors detected and filtered silently.');
          console.warn('[INFO] This is expected behavior on Windows. The server will continue normally.\n');
        }
      }
      return;
    }
    
    // Windows 파일 잠금 에러 패턴 확인
    const shouldFilter = shouldFilterError(trimmedLine);
    
    if (shouldFilter) {
      // 에러 블록 시작 또는 계속
      isInErrorBlock = true;
      errorBlockLines.push(trimmedLine);
      
      // 최대 줄 수 제한
      if (errorBlockLines.length > MAX_BLOCK_LINES) {
        errorBlockLines.shift();
      }
      
      // 필터링 (출력하지 않음)
      return;
    }
    
    // 에러 블록이었다면 종료
    if (isInErrorBlock) {
      filteredErrorCount++;
      errorBlockLines = [];
      isInErrorBlock = false;
      
      if (filteredErrorCount === maxFilteredErrorsToLog) {
        console.warn('[INFO] Windows file lock errors detected and filtered silently.');
        console.warn('[INFO] This is expected behavior on Windows. The server will continue normally.\n');
      }
    }
    
    // 다른 에러는 그대로 출력
    process.stderr.write(line + '\n');
  });
});

// 프로세스 종료 처리
nextDev.on('close', (code) => {
  if (filteredErrorCount > 0) {
    console.log(`\n[INFO] Filtered ${filteredErrorCount} Windows file lock error(s) during this session.`);
  }
  
  process.exit(code || 0);
});

// 시그널 처리 (Ctrl+C 등)
process.on('SIGINT', () => {
  nextDev.kill('SIGINT');
});

process.on('SIGTERM', () => {
  nextDev.kill('SIGTERM');
});

