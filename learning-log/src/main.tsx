import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ensureSeedTags } from './data/repository/tagRepo';
import { requestPersistentStorage } from './data/db';
import './styles.css';

async function bootstrap() {
  try {
    await ensureSeedTags();
  } catch (error) {
    console.error('初始化标签失败', error);
  }
  requestPersistentStorage().catch(() => undefined);

  const container = document.getElementById('root');
  if (!container) throw new Error('找不到 #root 节点');

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();