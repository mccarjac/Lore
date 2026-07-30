import {
  notifyLocalDataChanged,
  onLocalDataChanged,
  resetLocalDataChangeListeners,
} from '@/utils/dataChangeSignal';

describe('dataChangeSignal', () => {
  afterEach(() => {
    resetLocalDataChangeListeners();
  });

  it('calls every subscribed listener on notify', () => {
    const a = jest.fn();
    const b = jest.fn();
    onLocalDataChanged(a);
    onLocalDataChanged(b);

    notifyLocalDataChanged();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('stops calling a listener after it unsubscribes', () => {
    const listener = jest.fn();
    const unsubscribe = onLocalDataChanged(listener);

    notifyLocalDataChanged();
    unsubscribe();
    notifyLocalDataChanged();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('a throwing listener does not stop the others from running', () => {
    const good = jest.fn();
    onLocalDataChanged(() => {
      throw new Error('boom');
    });
    onLocalDataChanged(good);

    expect(() => notifyLocalDataChanged()).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('notifying with no listeners is a no-op', () => {
    expect(() => notifyLocalDataChanged()).not.toThrow();
  });
});
