const { spawn, exec } = require('child_process');
const os = require('os');

const platform = os.platform();
const isWindows = platform === 'win32';

console.log('\n========================================');
console.log('     ZOOM VIDEO APP - AUTO STARTER');
console.log('========================================\n');

// Kill processes on ports 8000 and 3000
function killPort(port) {
  return new Promise((resolve) => {
    if (isWindows) {
      exec(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do taskkill /F /PID %a`, 
        { shell: 'cmd.exe' }, 
        () => resolve()
      );
    } else {
      exec(`lsof -ti:${port} | xargs kill -9`, () => resolve());
    }
    setTimeout(resolve, 2000);
  });
}

async function start() {
  console.log('[1/4] Cleaning up old processes...');
  await killPort(8000);
  await killPort(3000);
  console.log('✅ Ports cleaned\n');

  console.log('[2/4] Starting Backend Server...');
  const backend = spawn('npm', ['run', 'dev'], {
    cwd: './MeetTrack-AI/backend',
    shell: true,
    stdio: 'inherit'
  });

  backend.on('error', (err) => {
    console.error('❌ Backend error:', err);
  });

  // Wait for backend to start
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('✅ Backend running on port 8000\n');

  console.log('[3/4] Starting Frontend Server...');
  const frontend = spawn('npm', ['start'], {
    cwd: './MeetTrack-AI/frontend',
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, BROWSER: 'none' }
  });

  frontend.on('error', (err) => {
    console.error('❌ Frontend error:', err);
  });

  console.log('✅ Frontend starting on port 3000\n');

  console.log('[4/4] Opening browser in 10 seconds...');
  setTimeout(() => {
    const cmd = isWindows ? 'start' : 'open';
    exec(`${cmd} http://localhost:3000`);
    console.log('✅ Browser opened!\n');
  }, 10000);

  console.log('========================================');
  console.log('     APP IS RUNNING!');
  console.log('========================================');
  console.log('Backend:  http://localhost:8000');
  console.log('Frontend: http://localhost:3000');
  console.log('\n⚠️  DO NOT CLOSE THIS WINDOW!\n');
  console.log('Press Ctrl+C to stop all servers\n');

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\nStopping servers...');
    backend.kill();
    frontend.kill();
    process.exit(0);
  });
}

start().catch(console.error);