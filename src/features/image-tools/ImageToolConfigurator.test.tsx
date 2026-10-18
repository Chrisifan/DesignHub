import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ImageToolConfigurator } from './ImageToolConfigurator';

it('marks required batch parameters and provides help triggers', () => {
  render(<ImageToolConfigurator
    locale="zh-CN"
    tool="resize"
    open
    sourcePath="/images/source"
    outputRoot="/images/output"
    sourceLabel="source"
    outputLabel="output"
    resultFolderName="results"
    scan={null}
    connectionId=""
    connections={[]}
    width={100}
    height={100}
    scale={2}
    preserveDetails="balanced"
    fit="contain"
    format="png"
    background="#ffffff"
    error=""
    canCreate={false}
    onClose={vi.fn()}
    onChooseInput={vi.fn()}
    onChooseOutput={vi.fn()}
    onScan={vi.fn()}
    onCreate={vi.fn()}
    setConnectionId={vi.fn()}
    setWidth={vi.fn()}
    setHeight={vi.fn()}
    setScale={vi.fn()}
    setPreserveDetails={vi.fn()}
    setFit={vi.fn()}
    setFormat={vi.fn()}
    setBackground={vi.fn()}
    setResultFolderName={vi.fn()}
  />);

  expect(screen.getByLabelText('宽度').closest('.ui-field')).toHaveAttribute('data-required', 'true');
  expect(screen.getByLabelText('高度').closest('.ui-field')).toHaveAttribute('data-required', 'true');
  expect(screen.getByRole('img', { name: '查看宽度帮助' })).toBeInTheDocument();
});
