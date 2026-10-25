import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Animated, Text } from 'react-native';

import { ChatRow, Composer, EmptyChat, FloatingReactions, HostBar, ReactionRow, ReconnectingPanel, StageControls } from './LiveStreamUI';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const texts = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
const byLabel = (n: ReactTestInstance, label: string) => n.findAll((x) => x.props.accessibilityLabel === label && typeof x.props.onPress === 'function')[0];

async function mount(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(el);
  });
  return r;
}

describe('Live Stream screen pieces', () => {
  it('host bar wires Gift and Like to the handlers it is given, and hides Gift without one', async () => {
    const gift = jest.fn();
    const like = jest.fn();
    const r = await mount(<HostBar title="Kigali Gala" hostName="Mugwiza" live onGift={gift} onLike={like} />);
    await act(async () => byLabel(r.root, 'Send a gift').props.onPress());
    await act(async () => byLabel(r.root, 'Like').props.onPress());
    expect(gift).toHaveBeenCalledTimes(1);
    expect(like).toHaveBeenCalledTimes(1);
    const r2 = await mount(<HostBar title="Kigali Gala" live onLike={like} />);
    expect(byLabel(r2.root, 'Send a gift')).toBeUndefined();
  });

  it('stage controls show the viewer count only when the client has one', async () => {
    const base = { opacity: new Animated.Value(1), visible: true, live: true, muted: false, onBack: jest.fn(), onToggleMute: jest.fn(), onFullscreen: jest.fn() };
    const withCount = await mount(<StageControls {...base} viewerCount={1200} />);
    expect(texts(withCount.root)).toContain('1.2K');
    const none = await mount(<StageControls {...base} viewerCount={0} />);
    expect(texts(none.root).some((t) => /watching|K$/.test(t))).toBe(false);
  });

  it('a host message carries the HOST tag and a viewer message does not', async () => {
    const host = await mount(<ChatRow name="Mugwiza" isOwn={false} isHost youLabel="YOU"><Text>Hi</Text></ChatRow>);
    expect(texts(host.root)).toContain('HOST');
    const viewer = await mount(<ChatRow name="Aline" isOwn={false} isHost={false} youLabel="YOU"><Text>Hi</Text></ChatRow>);
    expect(texts(viewer.root)).not.toContain('HOST');
  });

  it('quick-hello chips only hand their text to onPick', async () => {
    const pick = jest.fn();
    const r = await mount(<EmptyChat onPick={pick} phrases={['Hello 👋']} />);
    await act(async () => byLabel(r.root, 'Use "Hello 👋"').props.onPress());
    expect(pick).toHaveBeenCalledWith('Hello 👋');
  });

  it('reaction buttons and retry call the existing handlers', async () => {
    const react = jest.fn();
    const retry = jest.fn();
    const rr = await mount(<ReactionRow emojis={['🔥']} onReact={react} />);
    await act(async () => byLabel(rr.root, 'React with 🔥').props.onPress());
    expect(react).toHaveBeenCalledWith('🔥');
    const rc = await mount(<ReconnectingPanel onRetry={retry} />);
    expect(texts(rc.root)).toEqual(expect.arrayContaining(['Reconnecting…', 'Retry now']));
    await act(async () => byLabel(rc.root, 'Retry now').props.onPress());
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('send is disabled for an empty draft and the camera stays reachable', async () => {
    const send = jest.fn();
    const r = await mount(<Composer value=" " onChange={jest.fn()} onSend={send} onVideo={jest.fn()} videoSending={false} sending={false} placeholder="Add your name to comment" bottomInset={0} />);
    const btn = r.root.findAll((x) => x.props.accessibilityLabel === 'Send message')[0];
    expect(btn.props.disabled).toBe(true);
    expect(byLabel(r.root, 'Send a video')).toBeDefined();
  });

  it('floating reactions render their emoji', async () => {
    const r = await mount(<FloatingReactions items={[{ id: 'a', emoji: '🔥', anim: new Animated.Value(0), offset: 4 }]} />);
    expect(texts(r.root)).toContain('🔥');
  });
});
