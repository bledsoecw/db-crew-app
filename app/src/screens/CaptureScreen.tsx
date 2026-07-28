import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';

import { Figures, LiveDot, Tap } from '../components/ui';
import { CameraIcon, VideoIcon } from '../icons';
import { MAX_VIDEO_SECONDS } from '../config';
import { mmss, pad2 } from '../lib/time';
import { useShift } from '../state/shiftStore';
import { FIXED, useTheme } from '../theme/theme';
import { radius, white } from '../theme/tokens';
import { archivo, barlow, mono } from '../theme/type';
import type { PhotoTag } from '../types';

/**
 * One tap plus one tag. Everything else — area, code, time, who — is inferred,
 * so a crew member never types on a roof.
 */
export function CaptureScreen({ topInset }: { topInset: number }) {
  const { c } = useTheme();
  const s = useShift();
  const camera = useRef<CameraView>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [busy, setBusy] = useState(false);
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) void requestPerm();
  }, [perm, requestPerm]);

  const fireFlash = useCallback(() => {
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 0.95, duration: 26, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 234, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [flash]);

  const shoot = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (s.mode === 'video') {
        if (!s.recording) {
          if (micPerm && !micPerm.granted && micPerm.canAskAgain) await requestMicPerm();
          s.startRecording();
          s.say(`Recording ${s.capture}`);
          const clip = await camera.current?.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
          s.stopRecording();
          if (clip?.uri) {
            await s.record(clip.uri, 'video');
            s.say(`Clip saved · ${s.capture}`);
          }
        } else {
          camera.current?.stopRecording();
        }
        return;
      }
      fireFlash();
      const pic = await camera.current?.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (pic?.uri) await s.record(pic.uri, 'photo');
    } catch {
      s.say('Camera did not respond — try again');
      s.stopRecording();
    } finally {
      setBusy(false);
    }
  }, [busy, fireFlash, micPerm, requestMicPerm, s]);

  const last = s.photos[s.photos.length - 1] ?? null;
  const counts: Record<PhotoTag, number> = {
    before: s.photos.filter((p) => p.tag === 'before').length,
    during: s.photos.filter((p) => p.tag === 'during').length,
    after: s.photos.filter((p) => p.tag === 'after').length,
  };

  return (
    <View style={{ flex: 1, backgroundColor: FIXED.camBg }}>
      <View style={{ flex: 1, backgroundColor: FIXED.camPreview, overflow: 'hidden' }}>
        {perm?.granted ? (
          <CameraView
            ref={camera}
            style={{ flex: 1 }}
            facing="back"
            mode={s.mode === 'video' ? 'video' : 'picture'}
          />
        ) : (
          <PermissionWall onPress={() => void requestPerm()} granted={!!perm} />
        )}

        {/* framing corners */}
        <Corner style={{ top: 20, left: 20, borderLeftWidth: 2, borderTopWidth: 2 }} />
        <Corner style={{ top: 20, right: 20, borderRightWidth: 2, borderTopWidth: 2 }} />
        <Corner style={{ bottom: 20, left: 20, borderLeftWidth: 2, borderBottomWidth: 2 }} />
        <Corner style={{ bottom: 20, right: 20, borderRightWidth: 2, borderBottomWidth: 2 }} />

        {/* every shot carries its address and its code, stamped on the frame */}
        <View
          style={{
            position: 'absolute',
            top: topInset + 11,
            left: 0,
            right: 0,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ gap: 6, alignItems: 'flex-start' }}>
            <Stamp>{s.job?.address ?? ''}</Stamp>
            <Stamp tone="go">
              {s.active ? `${s.active.n} ${s.active.name}` : 'Not clocked in'}
            </Stamp>
          </View>
          <Stamp>{pad2(s.photos.length)} today</Stamp>
        </View>

        {s.afterRequired ? (
          <View
            style={{
              position: 'absolute',
              top: topInset + 71,
              left: 0,
              right: 0,
              paddingHorizontal: 16,
              alignItems: 'center',
            }}
          >
            <Text
              style={[
                mono(10.5, { track: 0.09, lh: 1.4, color: FIXED.warnInk }),
                {
                  backgroundColor: FIXED.warn,
                  paddingHorizontal: 13,
                  paddingVertical: 11,
                  borderRadius: radius.sm,
                  textAlign: 'center',
                  overflow: 'hidden',
                },
              ]}
            >
              After photo of {s.active ? `${s.active.n} ${s.active.name}` : ''} required to start{' '}
              {s.nextCode?.n ?? ''}
            </Text>
          </View>
        ) : null}

        {s.recording ? (
          <View style={{ position: 'absolute', top: topInset + 73, left: 0, right: 0, alignItems: 'center' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(192,57,43,.92)',
                paddingHorizontal: 13,
                paddingVertical: 9,
                borderRadius: radius.sm,
              }}
            >
              <LiveDot size={9} color={white} />
              <Figures style={mono(12, { track: 0.09, color: white })}>
                Rec {mmss(s.recSeconds)}
              </Figures>
            </View>
          </View>
        ) : null}

        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', inset: 0, backgroundColor: white, opacity: flash }}
        />
      </View>

      <View style={{ backgroundColor: FIXED.camBg, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['before', 'during', 'after'] as PhotoTag[]).map((t) => (
            <TagButton key={t} tag={t} count={counts[t]} />
          ))}
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingBottom: 6,
          }}
        >
          <Tap
            accessibilityRole="button"
            accessibilityLabel={s.mode === 'photo' ? 'Switch to video' : 'Switch to photo'}
            onPress={s.toggleMode}
            style={{
              width: 86,
              height: 86,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: 'rgba(255,255,255,.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,.18)',
              borderRadius: radius.md + 1,
            }}
          >
            {s.mode === 'photo' ? <VideoIcon size={26} color={white} /> : <CameraIcon size={26} color={white} strokeWidth={2} />}
            <Text style={mono(9.5, { track: 0.09, color: white })}>
              {s.mode === 'photo' ? 'Video' : 'Photo'}
            </Text>
          </Tap>

          <Tap
            accessibilityRole="button"
            accessibilityLabel="Shutter"
            weight="medium"
            onPress={() => void shoot()}
            style={{
              width: 104,
              height: 104,
              borderRadius: 52,
              borderWidth: 4,
              borderColor: 'rgba(255,255,255,.9)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 82,
                height: 82,
                borderRadius: s.recording ? 12 : 41,
                backgroundColor: s.recording || s.mode === 'video' ? FIXED.rec : white,
              }}
            />
          </Tap>

          <Tap
            accessibilityRole="button"
            accessibilityLabel="Open the day log"
            onPress={() => s.setTab('log')}
            style={{
              width: 86,
              height: 86,
              borderRadius: radius.md + 1,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,.18)',
              backgroundColor: FIXED.camTile,
              overflow: 'hidden',
              justifyContent: 'flex-end',
              alignItems: 'flex-start',
            }}
          >
            {last?.uri ? (
              <Image source={{ uri: last.uri }} style={{ position: 'absolute', width: 86, height: 86 }} />
            ) : null}
            <Text
              style={[
                mono(9.5, { track: 0.09, color: white }),
                {
                  backgroundColor: 'rgba(0,0,0,.65)',
                  paddingHorizontal: 6,
                  paddingVertical: 5,
                  margin: 6,
                  overflow: 'hidden',
                },
              ]}
            >
              {pad2(s.photos.length)}
            </Text>
          </Tap>
        </View>
      </View>
    </View>
  );

  function Corner({ style }: { style: object }) {
    return (
      <View
        pointerEvents="none"
        style={[{ position: 'absolute', width: 34, height: 34, borderColor: 'rgba(255,255,255,.4)' }, style]}
      />
    );
  }

  function Stamp({ children, tone }: { children: React.ReactNode; tone?: 'go' }) {
    return (
      <Text
        style={[
          mono(10, { track: tone === 'go' ? 0.09 : 0.14, color: tone === 'go' ? FIXED.goInk : white }),
          {
            backgroundColor: tone === 'go' ? FIXED.go : 'rgba(0,0,0,.6)',
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: radius.sm,
            overflow: 'hidden',
          },
        ]}
      >
        {children}
      </Text>
    );
  }

  function TagButton({ tag, count }: { tag: PhotoTag; count: number }) {
    const on = s.capture === tag;
    return (
      <Tap
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => s.setCapture(tag)}
        style={{
          flex: 1,
          minHeight: 66,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          borderRadius: radius.md,
          borderWidth: 2,
          borderColor: on ? FIXED.go : 'rgba(255,255,255,.28)',
          backgroundColor: on ? FIXED.go : 'transparent',
        }}
      >
        <Text style={archivo(15, { track: 0.05, color: on ? FIXED.goInk : white })}>{tag}</Text>
        <Figures style={[mono(10, { track: 0.09, color: on ? FIXED.goInk : white }), { opacity: 0.68 }]}>
          {pad2(count)}
        </Figures>
      </Tap>
    );
  }

  function PermissionWall({ onPress, granted }: { onPress: () => void; granted: boolean }) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 }}>
        <CameraIcon size={52} color={white} strokeWidth={1.4} />
        <Text style={[barlow(15, { lh: 1.5, color: 'rgba(255,255,255,.76)' }), { textAlign: 'center' }]}>
          {granted
            ? 'Camera access is off. Turn it on in Settings — photos are how the job gets proved.'
            : 'DB Time Clock needs the camera to document the job.'}
        </Text>
        <Tap
          accessibilityRole="button"
          onPress={onPress}
          style={{
            minHeight: 66,
            paddingHorizontal: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: FIXED.go,
            borderRadius: radius.md + 1,
          }}
        >
          <Text style={archivo(17, { track: 0.04, color: FIXED.goInk })}>Allow camera</Text>
        </Tap>
      </View>
    );
  }
}
