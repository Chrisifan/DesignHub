import { expect, it } from 'vitest';
import { switchDesigner } from './handoff';

it('切换不修改已提交任务的设计师快照', () => {
  const project = { activeDesignerVersionId: 'a-v1' };
  const task = { designerVersionId: project.activeDesignerVersionId };
  expect(switchDesigner(project, 'b-v1').activeDesignerVersionId).toBe('b-v1');
  expect(task.designerVersionId).toBe('a-v1');
});
