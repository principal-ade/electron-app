import type { Application, Request, Response } from 'express';
import { SubsystemModelRegistryService } from '../stores/SubsystemModelRegistryService';

export function registerSubsystemModelRoutes(
  app: Application,
  registry: Pick<
    SubsystemModelRegistryService,
    'getModel'
  > = new SubsystemModelRegistryService(),
): void {
  app.get('/api/subsystem-models/:id', async (req: Request, res: Response) => {
    try {
      const model = await registry.getModel(String(req.params.id));
      if (!model) {
        res.status(404).json({
          success: false,
          error: 'unknown or invalid subsystem model id',
        });
        return;
      }
      res.json({ success: true, model });
    } catch (err) {
      console.error('[subsystemModelRoutes] read failed', err);
      res.status(500).json({
        success: false,
        error: 'failed to read subsystem model',
      });
    }
  });
}
