# ssh-as-promised

A pure NodeJS, promise based SSH library. Depends on the pure node SSH implementation from [ssh2](https://www.npmjs.com/package/ssh2).

WORK_IN_PROGRESS: Minimal features implemented as required by ongoing projects

Pull requests welcome.

# Usage

```
npm install ssh-as-promised
```

```javascript
const SSH = require('ssh-as-promised');

// options are those for the SSH connection as required
// by the `ssh2` library
const client = new SSH({
  host: 'hostname',
  port: 22,
  username: 'username',
  privateKey: require('fs').readFileSync(process.env['HOME'] + '/.ssh/id_rsa'),
  readyTimeout: 60000
});

client.exec('pwd')
.then(result =>{
  // stdout and stderr will be of type Buffer
  console.log('stdout:\n' + result.stdout);
  console.log('stderr:\n' + result.stderr);
  // exit code
  console.log('code: ' + result.code);
  // signal received or undefined
  console.log('signal: ' + result.signal);
})
.catch(error => {
  console.error(error);
});
```
