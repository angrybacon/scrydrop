import type { OutgoingHttpHeaders } from 'node:http';
import type { Index } from './ingest';
import type { Card } from './schemas';

import { describe, expect, it, vi } from 'vitest';

import { handle } from './handle';
import { resolve } from './resolve';

vi.mock('./resolve');

const doomsday: Card = {
  collector_number: '213',
  name: 'Doomsday',
  object: 'card',
  released_at: '1997-06-09',
  set: 'wth',
};

const mockResponse = () => ({
  end: vi.fn<() => void>(),
  write: vi.fn<(chunk: string) => void>(),
  writeHead: vi.fn<(status: number, headers: OutgoingHttpHeaders) => void>(),
});

describe(handle, () => {
  const index: Index = {};

  it('should resolve a bare name query and write the matching cards', () => {
    // Given
    vi.mocked(resolve).mockReturnValue([doomsday]);
    const response = mockResponse();
    // When
    handle(index)({ url: '?name=Doomsday' }, response);
    // Then
    expect(resolve).toHaveBeenCalledWith(index, { name: 'Doomsday' });
    expect(response.writeHead).toHaveBeenCalledWith(200, {
      'content-type': 'application/json; charset=utf-8',
    });
    expect(response.write).toHaveBeenCalledWith(
      JSON.stringify({ data: [doomsday], has_more: false, object: 'list' }),
    );
    expect(response.end).toHaveBeenCalled();
  });

  it('should resolve a query with a set but no collector number', () => {
    // Given
    vi.mocked(resolve).mockReturnValue([doomsday]);
    const response = mockResponse();
    // When
    handle(index)({ url: '?name=Doomsday&set=wth' }, response);
    // Then
    const expected = { name: 'Doomsday', set: 'wth' };
    expect(resolve).toHaveBeenCalledWith(index, expected);
  });

  it('should resolve a query with a name, set, and collector number', () => {
    // Given
    vi.mocked(resolve).mockReturnValue([doomsday]);
    const response = mockResponse();
    // When
    handle(index)({ url: '?name=Doomsday&number=213&set=wth' }, response);
    // Then
    const expected = { name: 'Doomsday', number: '213', set: 'wth' };
    expect(resolve).toHaveBeenCalledWith(index, expected);
  });

  it('should reject a query missing the name parameter without calling resolve', () => {
    // Given
    const response = mockResponse();
    // When
    handle(index)({ url: '?set=wth' }, response);
    // Then
    expect(resolve).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(400, {
      'content-type': 'text/plain; charset=utf-8',
    });
    expect(response.write).toHaveBeenCalledWith(
      'Invalid identifier in "?set=wth"',
    );
    expect(response.end).toHaveBeenCalled();
  });

  it('should write a not found response when resolve returns no cards', () => {
    // Given
    vi.mocked(resolve).mockReturnValue([]);
    const response = mockResponse();
    // When
    handle(index)({ url: '?name=Unknown' }, response);
    // Then
    expect(response.writeHead).toHaveBeenCalledWith(404, {
      'content-type': 'text/plain; charset=utf-8',
    });
    expect(response.write).toHaveBeenCalledWith(
      'Could not find indexed data for "?name=Unknown"',
    );
    expect(response.end).toHaveBeenCalled();
  });
});
