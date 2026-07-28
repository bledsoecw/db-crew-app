import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';

import { CloseIcon } from '../icons';
import { useTheme } from '../theme/theme';
import { radius } from '../theme/tokens';
import { archivo } from '../theme/type';
import { Rise, Tap } from './ui';

/**
 * The bottom sheet shell. Everything that interrupts the clock comes up from
 * the bottom, within thumb reach, with a 56px close target and a tap-anywhere
 * scrim above it.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.62)' }}>
        <Tap
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ flex: 1, minHeight: 70 }}
        />
        <Rise from={22} duration={220} style={{ maxHeight: '86%' }}>
          <View
            style={{
              backgroundColor: c.bg,
              borderTopWidth: 1,
              borderTopColor: c.line2,
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingLeft: 20,
                paddingRight: 12,
                paddingTop: 16,
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: c.line,
              }}
            >
              <Text numberOfLines={1} style={archivo(18, { track: 0.03, lh: 1.1, weight: 700, color: c.fg })}>
                {title}
              </Text>
              <Tap
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={{
                  width: 56,
                  height: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: c.chip,
                  borderRadius: radius.md,
                }}
              >
                <CloseIcon size={24} color={c.fg} />
              </Tap>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </View>
        </Rise>
      </View>
    </Modal>
  );
}
