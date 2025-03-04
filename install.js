import { spawnSync } from 'child_process';
import process from 'process';

if (process.platform === 'win32') {
	spawnSync('npm.cmd', ['run', 'node-gyp-build'], {
		input: 'win32 detected. Ensure native code prebuild or rebuild it',
		shell: true,
		stdio: 'inherit'
	});
}
