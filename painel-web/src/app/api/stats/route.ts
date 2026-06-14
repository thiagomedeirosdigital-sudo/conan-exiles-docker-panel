import { NextResponse } from 'next/server';
import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export async function GET() {
  try {
    const container = docker.getContainer('conan-exiles-enhanced');
    const stats = await container.stats({ stream: false });

    // Cálculo de RAM
    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 1;
    const ramPercent = ((memoryUsage / memoryLimit) * 100).toFixed(1);
    const ramGB = (memoryUsage / (1024 * 1024 * 1024)).toFixed(1);
    const ramLimitGB = (memoryLimit / (1024 * 1024 * 1024)).toFixed(0);

    // Cálculo de CPU baseado no Delta do Linux
    const cpuUsage = stats.cpu_stats.cpu_usage.total_usage || 0;
    const precpuUsage = stats.precpu_stats.cpu_usage.total_usage || 0;
    const systemCpuUsage = stats.cpu_stats.system_cpu_usage || 0;
    const presystemCpuUsage = stats.precpu_stats.system_cpu_usage || 0;

    const cpuDelta = cpuUsage - precpuUsage;
    const systemDelta = systemCpuUsage - presystemCpuUsage;
    let cpuPercent = "0.0";

    if (systemDelta > 0 && cpuDelta > 0) {
      const onlineCpus = stats.cpu_stats.online_cpus || 4;
      cpuPercent = ((cpuDelta / systemDelta) * onlineCpus * 100).toFixed(1);
    }

    return NextResponse.json({ status: 'Online', cpu: cpuPercent, ram: { percent: ramPercent, used: ramGB, total: ramLimitGB } });
  } catch (error) {
    return NextResponse.json({ status: 'Offline', cpu: '0.0', ram: { percent: '0', used: '0', total: '0' } });
  }
}
