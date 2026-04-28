module.exports = {
  apps: [
    {
      name: 'taxi-system',
      script: '/home/ubuntu/taxi-system/start-taxi.sh',
      cwd: '/home/ubuntu/taxi-system',
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
