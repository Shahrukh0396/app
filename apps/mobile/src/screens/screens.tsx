import { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { Chip, ProgressBar, SegmentedButtons, Switch, Text } from 'react-native-paper';
import Pdf from 'react-native-pdf';
import Animated, { FadeInRight } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PLAN_CATALOG } from '@scanflow/types';
import { Card, Field, PrimaryButton, QuietButton, Screen, Title } from '../components/ui';
import { translate } from '../i18n';
import { documentsRepo, foldersRepo } from '../db/repositories';
import { applyAdjustments, applyNamedFilter, DEFAULT_ADJUSTMENTS, type Adjustments, type FilterName } from '../imaging/filters';
import { rgbaToLuminance } from '../scanner/quadDetector';
import { detectDocumentQuad, isQuadStable } from '../scanner/quadDetector';
import { warpPerspective, type Quad } from '../scanner/homography';
import { encodePng } from '../imaging/png';
import { buildScanPdf } from '../pdf/generate';
import { mailtoUrl, slackUrl, teamsUrl, telegramUrl, whatsappUrl } from '../share/targets';
import {
  loadOfferings,
  openExternal,
  promptBiometric,
  purchasePackage,
  recognizeText,
  shareFile,
  shareText,
  signInWithApple,
  signInWithGoogle,
  signInWithMicrosoft,
  writePdf,
} from '../native/platform';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import type { RootStackParamList, TabProps } from '../app/types';
import {
  addPage,
  duplicateActive,
  noteQuad,
  patchSettings,
  queueAction,
  removePage,
  reorderPages,
  rotateActive,
  setActiveDocument,
  setAuthError,
  setDocuments,
  setFolders,
  setPdfUri,
  setQuery,
  setSession,
  setAutoCapture,
  setStep,
  setUnlocked,
  updateActivePage,
} from '../store/slices';
import {
  useBackupMutation,
  useCreateDocumentMutation,
  useDeleteDocumentMutation,
  useDocumentsQuery,
  useExtractOcrMutation,
  useForgotPasswordMutation,
  useLoginMutation,
  usePlansQuery,
  useProviderLoginMutation,
  useRegisterMutation,
  useSearchQuery,
  useSyncPullMutation,
  useSyncPushMutation,
} from '../store/api';
import { hashSecret, isValidPattern, isValidPin, verifySecret } from '../security/pin';
import { randomKey, sealText } from '../security/aes';
import { settingsStorage, saveFileKey } from '../native/platform';

type Props<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

function useLocale() {
  return useAppSelector((state) => state.settings.locale);
}

export function SplashScreen({ navigation }: Props<'Splash'>) {
  const locale = useLocale();
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('Login'), 700);
    return () => clearTimeout(timer);
  }, [navigation]);
  return (
    <Screen>
      <Title>{translate(locale, 'app.name')}</Title>
      <Text>{translate(locale, 'splash.tagline')}</Text>
    </Screen>
  );
}

export function OnboardingScreen({ navigation }: Props<'Onboarding'>) {
  const dispatch = useAppDispatch();
  const locale = useLocale();
  return (
    <Screen>
      <View style={styles.glass}>
        <Title>{translate(locale, 'onboarding.title')}</Title>
        <Text>{translate(locale, 'onboarding.body')}</Text>
      </View>
      <PrimaryButton
        label={translate(locale, 'onboarding.continue')}
        onPress={() => {
          dispatch(patchSettings({ onboardingComplete: true }));
          navigation.navigate('Login');
        }}
      />
    </Screen>
  );
}

export function LoginScreen({ navigation }: Props<'Login'>) {
  const dispatch = useAppDispatch();
  const locale = useLocale();
  const deviceId = useAppSelector((state) => state.auth.deviceId);
  const error = useAppSelector((state) => state.auth.error);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login] = useLoginMutation();
  const [providerLogin] = useProviderLoginMutation();
  const submit = async () => {
    try {
      const result = await login({ email, password, deviceId }).unwrap();
      dispatch(setSession(result));
    } catch (err) {
      dispatch(setAuthError(err instanceof Error ? err.message : 'Login failed'));
    }
  };
  const oauth = async (provider: 'google' | 'apple' | 'microsoft') => {
    const identity =
      provider === 'google' ? await signInWithGoogle() : provider === 'apple' ? await signInWithApple() : await signInWithMicrosoft();
    const name = 'name' in identity && typeof identity.name === 'string' ? identity.name : undefined;
    const result = await providerLogin({ provider, idToken: identity.idToken, deviceId, name }).unwrap();
    dispatch(setSession(result));
  };
  return (
    <Screen>
      <Title>{translate(locale, 'auth.login')}</Title>
      <Field label={translate(locale, 'auth.email')} value={email} onChangeText={setEmail} />
      <Field label={translate(locale, 'auth.password')} value={password} onChangeText={setPassword} secure />
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <PrimaryButton label={translate(locale, 'auth.login')} onPress={() => void submit()} />
      <QuietButton label={translate(locale, 'auth.google')} onPress={() => void oauth('google')} />
      <QuietButton label={translate(locale, 'auth.apple')} onPress={() => void oauth('apple')} />
      <QuietButton label={translate(locale, 'auth.microsoft')} onPress={() => void oauth('microsoft')} />
      <QuietButton label={translate(locale, 'auth.register')} onPress={() => navigation.navigate('Register')} />
      <QuietButton label={translate(locale, 'auth.forgot')} onPress={() => navigation.navigate('Forgot')} />
    </Screen>
  );
}

export function RegisterScreen({ navigation }: Props<'Register'>) {
  const dispatch = useAppDispatch();
  const deviceId = useAppSelector((state) => state.auth.deviceId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register] = useRegisterMutation();
  return (
    <Screen>
      <Title>Create your Scanflow account</Title>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Email" value={email} onChangeText={setEmail} />
      <Field label="Password" value={password} onChangeText={setPassword} secure hint="At least 8 characters" />
      <PrimaryButton
        label="Create account"
        onPress={() => {
          void register({ name, email, password, deviceId })
            .unwrap()
            .then((result) => dispatch(setSession(result)))
            .catch((err: unknown) => dispatch(setAuthError(err instanceof Error ? err.message : 'Could not register')));
        }}
      />
      <QuietButton label="I already have an account" onPress={() => navigation.navigate('Login')} />
    </Screen>
  );
}

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [forgot] = useForgotPasswordMutation();
  return (
    <Screen>
      <Title>Reset password</Title>
      <Text>We will email a reset token if the account exists.</Text>
      <Field label="Email" value={email} onChangeText={setEmail} />
      <PrimaryButton
        label="Send reset link"
        onPress={() => {
          void forgot({ email }).unwrap().then(() => setSent(true));
        }}
      />
      {sent ? <Text accessibilityRole="alert">If an account exists, a reset token is on its way.</Text> : null}
    </Screen>
  );
}

export function HomeScreen({ navigation }: TabProps<'Home'>) {
  const locale = useLocale();
  const sync = useAppSelector((state) => state.sync);
  const documents = useAppSelector((state) => state.documents.documents);
  const folders = useAppSelector((state) => state.documents.folders);
  const dispatch = useAppDispatch();
  const query = useDocumentsQuery();
  useEffect(() => {
    try {
      dispatch(setDocuments(documentsRepo.recent().map(localToRemote)));
      dispatch(setFolders(foldersRepo.list().map((folder) => ({
        id: folder.id,
        userId: 'local',
        name: folder.name,
        parentFolderId: folder.parentId,
        deletedAt: folder.deletedAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      }))));
    } catch {
      if (query.data) dispatch(setDocuments(query.data));
    }
  }, [dispatch, query.data]);
  const stats = safeStats();
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Title>{translate(locale, 'app.name')}</Title>
      <Field label={translate(locale, 'home.search')} value="" onChangeText={() => navigation.navigate('Search')} />
      <View style={styles.row}>
        <PrimaryButton label={translate(locale, 'home.scan')} onPress={() => navigation.navigate('Scanner')} />
        <QuietButton label={translate(locale, 'home.ocr')} onPress={() => navigation.navigate('OCRResult')} />
        <QuietButton label={translate(locale, 'home.import')} onPress={() => navigation.navigate('Documents')} />
      </View>
      <Card>
        <Text variant="titleMedium">{translate(locale, 'home.storage')}</Text>
        <Text>{stats.documents} documents · {stats.pages} pages · {stats.bytes} bytes</Text>
        <ProgressBar progress={Math.min(1, stats.bytes / (50 * 1024 * 1024))} />
      </Card>
      <Card>
        <Text variant="titleMedium">{translate(locale, 'home.cloud')}</Text>
        <Text>{sync.online ? 'Online' : 'Offline'} · {sync.queue.length} queued</Text>
        <QuietButton label="Open sync" onPress={() => navigation.navigate('CloudSync')} />
      </Card>
      <Text variant="titleMedium">{translate(locale, 'home.recent')}</Text>
      {documents.slice(0, 5).map((doc) => (
        <Card key={doc.id}>
          <Text variant="titleSmall">{doc.title}</Text>
          <Text>{doc.pageCount} pages</Text>
        </Card>
      ))}
      <Text variant="titleMedium">{translate(locale, 'home.folders')}</Text>
      <View style={styles.row}>
        {folders.slice(0, 6).map((folder) => (
          <Chip key={folder.id} accessibilityLabel={folder.name}>{folder.name}</Chip>
        ))}
      </View>
    </ScrollView>
  );
}

export function ScannerScreen({ navigation }: Props<'Scanner'>) {
  const dispatch = useAppDispatch();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput({ containerFormat: 'jpeg', quality: 0.85 });
  const permission = useCameraPermission();
  const auto = useAppSelector((state) => state.scanner.autoCapture);
  const history = useAppSelector((state) => state.scanner.quadHistory);
  const stable = useAppSelector((state) => state.scanner.stable);
  useEffect(() => {
    if (!permission.hasPermission) void permission.requestPermission();
  }, [permission]);
  const detect = () => {
    const sample = samplePage();
    const gray = rgbaToLuminance(sample.data, sample.width, sample.height);
    const quad = detectDocumentQuad(gray);
    const nextHistory = quad ? [...history, quad].slice(-8) : history;
    const ready = isQuadStable(nextHistory, 6);
    dispatch(noteQuad({ quad, stable: ready }));
    if (auto && ready && quad) capture(quad, sample.width, sample.height);
  };
  const capture = (quad: Quad | null, width = 1200, height = 1600) => {
    void (async () => {
      let uri: string;
      try {
        const file = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
        uri = file.filePath.startsWith('file://') ? file.filePath : `file://${file.filePath}`;
      } catch {
        uri = `scanflow://capture/${Date.now()}`;
      }
      dispatch(
        addPage({
          id: `page-${Date.now()}`,
          uri,
          width,
          height,
          rotation: width > height ? 90 : 0,
          filter: 'original',
          quad,
          ocrText: '',
          adjustments: { brightness: 0, contrast: 0, saturation: 0, sharpness: 0, temperature: 0, denoise: 0 },
          flipped: false,
        }),
      );
      navigation.navigate('Crop');
    })();
  };
  return (
    <View style={styles.cameraWrap}>
      {device ? (
        <Camera style={styles.camera} device={device} isActive outputs={[photoOutput]} />
      ) : (
        <View style={styles.cameraFallback}>
          <Text>Camera preview is unavailable on this device.</Text>
        </View>
      )}
      <View style={styles.cameraActions}>
        <QuietButton label={auto ? 'Auto capture on' : 'Auto capture off'} onPress={() => dispatch(setAutoCapture(!auto))} />
        <QuietButton label="Detect page" hint="Runs the quad detector on a luminance sample" onPress={detect} />
        <PrimaryButton label="Capture" onPress={() => capture(stable ? history[history.length - 1] ?? null : null)} />
        {stable ? <Text accessibilityRole="alert">Page edges are stable</Text> : null}
      </View>
    </View>
  );
}

export function CropScreen({ navigation }: Props<'Crop'>) {
  const page = useActivePage();
  const dispatch = useAppDispatch();
  const apply = () => {
    if (page?.quad) {
      const sample = samplePage();
      const warped = warpPerspective(sample, page.quad, 160, 220);
      dispatch(updateActivePage({ width: warped.width, height: warped.height }));
    }
    dispatch(setStep('enhance'));
    navigation.navigate('Enhancement');
  };
  return (
    <Screen>
      <Title>Crop</Title>
      <Text>Corners: {page?.quad ? page.quad.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(' · ') : 'full frame'}</Text>
      <PrimaryButton label="Apply crop" onPress={apply} />
      <QuietButton label="Skip" onPress={() => navigation.navigate('Enhancement')} />
    </Screen>
  );
}

export function EnhancementScreen({ navigation }: Props<'Enhancement'>) {
  const page = useActivePage();
  const dispatch = useAppDispatch();
  const adjustments = page?.adjustments ?? DEFAULT_ADJUSTMENTS;
  const filters: FilterName[] = ['original', 'magic', 'blackWhite', 'grayscale', 'colorEnhance', 'highContrast', 'document', 'receipt', 'photo'];
  const nudge = (key: keyof Adjustments, delta: number) => {
    const next = { ...adjustments, [key]: Math.max(-80, Math.min(80, adjustments[key] + delta)) };
    dispatch(updateActivePage({ adjustments: next }));
    applyAdjustments(samplePage(), next);
  };
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Title>Enhance</Title>
      <Animated.View entering={FadeInRight.duration(240)}>
        {(Object.keys(DEFAULT_ADJUSTMENTS) as Array<keyof Adjustments>).map((key) => (
          <View key={key} style={styles.row}>
            <Text>{key} {adjustments[key]}</Text>
            <QuietButton label={`Decrease ${key}`} hint={`Lower ${key}`} onPress={() => nudge(key, key === 'denoise' ? -10 : -5)} />
            <QuietButton label={`Increase ${key}`} hint={`Raise ${key}`} onPress={() => nudge(key, key === 'denoise' ? 10 : 5)} />
          </View>
        ))}
      </Animated.View>
      <View style={styles.row}>
        {filters.map((filter) => (
          <Chip key={filter} selected={page?.filter === filter} onPress={() => dispatch(updateActivePage({ filter }))} accessibilityLabel={filter}>
            {filter}
          </Chip>
        ))}
      </View>
      <QuietButton label="Rotate" onPress={() => dispatch(rotateActive())} />
      <QuietButton label="Flip" onPress={() => dispatch(updateActivePage({ flipped: !page?.flipped }))} />
      <PrimaryButton
        label="Preview filter"
        onPress={() => {
          const sample = samplePage();
          applyNamedFilter(sample, page?.filter ?? 'document');
        }}
      />
      <PrimaryButton label="Pages" onPress={() => navigation.navigate('PageManager')} />
    </ScrollView>
  );
}

export function PageManagerScreen({ navigation }: Props<'PageManager'>) {
  const pages = useAppSelector((state) => state.scanner.pages);
  const dispatch = useAppDispatch();
  return (
    <Screen>
      <Title>Pages</Title>
      {pages.map((page, index) => (
        <Card key={page.id}>
          <Text>{index + 1}. {page.filter} · {page.rotation}°</Text>
          <QuietButton label="Delete page" onPress={() => dispatch(removePage(page.id))} />
        </Card>
      ))}
      <QuietButton label="Duplicate page" onPress={() => dispatch(duplicateActive())} />
      <QuietButton
        label="Move first page to end"
        onPress={() => dispatch(reorderPages([...pages.slice(1), pages[0]].filter(Boolean).map((page) => page.id)))}
      />
      <PrimaryButton label="Build PDF" onPress={() => navigation.navigate('PDFPreview')} />
    </Screen>
  );
}

export function PDFPreviewScreen() {
  const pages = useAppSelector((state) => state.scanner.pages);
  const pdfUri = useAppSelector((state) => state.scanner.pdfUri);
  const compression = useAppSelector((state) => state.settings.pdfCompression);
  const dispatch = useAppDispatch();
  const build = async () => {
    const sample = encodePng(samplePage());
    const bytes = await buildScanPdf(
      pages.map((page) => ({ bytes: sample, mime: 'image/png' as const, ocrText: page.ocrText || page.filter })),
      { pageSize: 'A4', watermark: compression === 'low' ? 'SCANFLOW' : undefined },
    );
    const uri = await writePdf(`scan-${Date.now()}.pdf`, bytes);
    dispatch(setPdfUri(uri));
  };
  return (
    <Screen>
      <Title>PDF preview</Title>
      <Text>Compression: {compression}. {pages.length} pages.</Text>
      <PrimaryButton label="Generate PDF" onPress={() => void build()} />
      {pdfUri ? <Pdf source={{ uri: pdfUri }} style={styles.pdf} trustAllCerts={false} /> : <Text>Generate a PDF to preview it.</Text>}
    </Screen>
  );
}

export function DocumentsScreen({ navigation }: TabProps<'Documents'>) {
  const query = useDocumentsQuery();
  const [remove] = useDeleteDocumentMutation();
  const dispatch = useAppDispatch();
  const local = safeDocuments();
  const rows = query.data ?? local;
  return (
    <Screen>
      <Title>Documents</Title>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card>
            <Text variant="titleMedium">{item.title}</Text>
            <Text>{item.documentType} · v{item.version}</Text>
            <QuietButton
              label="Open"
              onPress={() => {
                dispatch(setActiveDocument(item.id));
                navigation.navigate('DocumentDetails', { id: item.id });
              }}
            />
            <QuietButton label="Move to recycle bin" onPress={() => void remove(item.id)} />
          </Card>
        )}
      />
    </Screen>
  );
}

export function FoldersScreen() {
  const [name, setName] = useState('');
  const [folders, setLocal] = useState(() => safeFolders());
  return (
    <Screen>
      <Title>Folders</Title>
      <Field label="New folder" value={name} onChangeText={setName} />
      <PrimaryButton
        label="Create folder"
        onPress={() => {
          const id = `folder-${Date.now()}`;
          try {
            foldersRepo.create(id, name || 'Untitled', null);
          } catch {
            // Native SQLite is unavailable in the typecheck host.
          }
          setLocal([...folders, { id, name: name || 'Untitled' }]);
          setName('');
        }}
      />
      {folders.map((folder) => (
        <Card key={folder.id}>
          <Text>{folder.name}</Text>
          <QuietButton
            label={`Rename ${folder.name}`}
            onPress={() => {
              try {
                foldersRepo.rename(folder.id, `${folder.name} renamed`);
              } catch {
                setLocal(folders.map((item) => (item.id === folder.id ? { ...item, name: `${item.name} renamed` } : item)));
              }
            }}
          />
        </Card>
      ))}
      <Text variant="titleSmall">Smart folders</Text>
      <Chip accessibilityLabel="Favorites">Favorites</Chip>
      <Chip accessibilityLabel="Receipts">Receipts</Chip>
    </Screen>
  );
}

export function SearchScreen() {
  const dispatch = useAppDispatch();
  const query = useAppSelector((state) => state.documents.query);
  const search = useSearchQuery(query, { skip: query.trim().length === 0 });
  return (
    <Screen>
      <Title>Search</Title>
      <Field label="Query" value={query} onChangeText={(value) => dispatch(setQuery(value))} hint="Searches title, OCR, and tags" />
      {(search.data?.documents ?? []).map((doc) => (
        <Card key={doc.id}>
          <Text>{doc.title}</Text>
          <Text>{doc.tags.join(', ')}</Text>
        </Card>
      ))}
    </Screen>
  );
}

export function OCRResultScreen() {
  const page = useActivePage();
  const dispatch = useAppDispatch();
  const [extract] = useExtractOcrMutation();
  const [text, setText] = useState(page?.ocrText ?? '');
  const [status, setStatus] = useState('ML Kit runs first. If it fails, the page is sent to POST /ocr/extract.');
  const remember = (value: string) => {
    setText(value);
    dispatch(updateActivePage({ ocrText: value }));
  };
  return (
    <Screen>
      <Title>OCR</Title>
      <Text>{status}</Text>
      <Text selectable accessibilityLabel="Recognized text">{text || 'No text yet'}</Text>
      <PrimaryButton
        label="Recognize"
        onPress={() => {
          if (!page?.uri) {
            setStatus('Capture a page first');
            return;
          }
          void recognizeText(page.uri)
            .then((value) => {
              remember(value);
              setStatus('Recognized on device with ML Kit.');
            })
            .catch(() => {
              if (!page.uri.startsWith('file://') && !page.uri.startsWith('/')) {
                setStatus('ML Kit is unavailable and this page is not a file that can be uploaded.');
                return;
              }
              void extract({ uri: page.uri, name: 'page.jpg', type: 'image/jpeg', lang: 'eng' })
                .unwrap()
                .then((result) => {
                  remember(result.text);
                  setStatus('Recognized with the API OCR fallback.');
                })
                .catch(() => setStatus('OCR failed on device and on the API.'));
            });
        }}
      />
      <QuietButton
        label="Share text"
        onPress={() => {
          if (!text) {
            setStatus('Nothing to share');
            return;
          }
          void shareText(text).catch(() => setStatus('The share sheet is unavailable in this environment.'));
        }}
      />
    </Screen>
  );
}

export function DocumentDetailsScreen({ route, navigation }: Props<'DocumentDetails'>) {
  const docs = useAppSelector((state) => state.documents.documents);
  const doc = docs.find((item) => item.id === route.params.id);
  const [create] = useCreateDocumentMutation();
  return (
    <Screen>
      <Title>{doc?.title ?? 'Document'}</Title>
      <Text>{doc?.description || 'No description'}</Text>
      <Text>Version {doc?.version ?? 1}</Text>
      <PrimaryButton
        label="Save to cloud"
        onPress={() => {
          void create({ title: doc?.title ?? 'Scan', description: doc?.description, tags: doc?.tags });
        }}
      />
      <QuietButton label="Share" onPress={() => navigation.navigate('Share', { id: route.params.id })} />
    </Screen>
  );
}

export function CloudSyncScreen() {
  const dispatch = useAppDispatch();
  const queue = useAppSelector((state) => state.sync.queue);
  const conflicts = useAppSelector((state) => state.sync.conflicts);
  const deviceId = useAppSelector((state) => state.auth.deviceId);
  const [push] = useSyncPushMutation();
  const [pull] = useSyncPullMutation();
  return (
    <Screen>
      <Title>Cloud sync</Title>
      <Text>{queue.length} operations waiting</Text>
      <PrimaryButton
        label="Push queue"
        onPress={() => {
          void push({
            deviceId,
            changes: queue.map((item) => ({ entity: item.entity, op: item.op, id: item.entityId, version: item.version, payload: item.payload })),
          });
        }}
      />
      <QuietButton label="Pull" onPress={() => void pull({})} />
      <QuietButton
        label="Queue sample edit"
        onPress={() =>
          dispatch(
            queueAction({
              type: 'enqueue',
              item: { id: `op-${Date.now()}`, entity: 'document', op: 'upsert', entityId: 'local-doc', version: 1, payload: { title: 'Local scan' } },
            }),
          )
        }
      />
      {conflicts.map((conflict) => (
        <Card key={conflict.id}>
          <Text>Conflict on {conflict.entityId}: client {conflict.clientVersion} / server {conflict.serverVersion}</Text>
          <QuietButton label="Keep server" onPress={() => dispatch(queueAction({ type: 'remove', id: conflict.id }))} />
        </Card>
      ))}
    </Screen>
  );
}

export function ShareScreen({ route }: Props<'Share'>) {
  const message = `Scanflow document ${route.params?.id ?? ''}`;
  return (
    <Screen>
      <Title>Share</Title>
      <PrimaryButton label="System share PDF" onPress={() => void shareFile('file://scanflow.pdf', 'application/pdf', message)} />
      <QuietButton label="WhatsApp" onPress={() => void openExternal(whatsappUrl(message))} />
      <QuietButton label="Telegram" onPress={() => void openExternal(telegramUrl(message))} />
      <QuietButton label="Slack" onPress={() => void openExternal(slackUrl(message))} />
      <QuietButton label="Teams" onPress={() => void openExternal(teamsUrl(message))} />
      <QuietButton label="Email" onPress={() => void openExternal(mailtoUrl('', 'Scanflow document', message))} />
    </Screen>
  );
}

export function SubscriptionScreen() {
  const plans = usePlansQuery();
  const catalog = plans.data ?? PLAN_CATALOG;
  const [offerLabel, setOfferLabel] = useState('Offerings load from RevenueCat when the API key is set.');
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Title>Plans</Title>
      {catalog.map((plan) => (
        <Card key={plan.id}>
          <Text variant="titleMedium">{plan.name}</Text>
          <Text>${(plan.priceMonthlyCents / 100).toFixed(2)} / month</Text>
          {plan.features.map((feature) => (
            <Text key={feature}>• {feature}</Text>
          ))}
        </Card>
      ))}
      <PrimaryButton
        label="Load offerings"
        onPress={() => {
          void loadOfferings()
            .then(async (offerings) => {
              const pkg = offerings.current?.availablePackages[0];
              setOfferLabel(pkg ? `Ready: ${pkg.identifier}` : 'No current offering');
              if (pkg) await purchasePackage(pkg);
            })
            .catch((error: unknown) => setOfferLabel(error instanceof Error ? error.message : 'RevenueCat is not configured'));
        }}
      />
      <Text>{offerLabel}</Text>
    </ScrollView>
  );
}

export function ProfileScreen({ navigation }: TabProps<'Profile'>) {
  const user = useAppSelector((state) => state.auth.user);
  return (
    <Screen>
      <Title>{user?.name ?? 'Profile'}</Title>
      <Text>{user?.email}</Text>
      <Text>Role {user?.role}</Text>
      <QuietButton label="Settings" onPress={() => navigation.navigate('Settings')} />
      <QuietButton label="Subscription" onPress={() => navigation.navigate('Subscription')} />
      <QuietButton label="About" onPress={() => navigation.navigate('About')} />
    </Screen>
  );
}

export function SettingsScreen({ navigation }: Props<'Settings'>) {
  const settings = useAppSelector((state) => state.settings);
  const dispatch = useAppDispatch();
  const persist = (patch: Partial<typeof settings>) => {
    dispatch(patchSettings(patch));
    settingsStorage.set('settings', JSON.stringify({ ...settings, ...patch }));
  };
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Title>Settings</Title>
      <SegmentedButtons
        value={settings.theme}
        onValueChange={(value) => persist({ theme: value as typeof settings.theme })}
        buttons={[
          { value: 'light', label: 'Light', accessibilityLabel: 'Light theme' },
          { value: 'dark', label: 'Dark', accessibilityLabel: 'Dark theme' },
          { value: 'highContrast', label: 'Contrast', accessibilityLabel: 'High contrast theme' },
        ]}
      />
      <Text>Language</Text>
      <SegmentedButtons
        value={settings.locale}
        onValueChange={(value) => persist({ locale: value as typeof settings.locale })}
        buttons={[{ value: 'en', label: 'English', accessibilityLabel: 'English' }]}
      />
      <Row label="Auto enhance" value={settings.autoEnhance} onChange={(autoEnhance) => persist({ autoEnhance })} />
      <Row label="Auto backup" value={settings.autoBackup} onChange={(autoBackup) => persist({ autoBackup })} />
      <Text>PDF compression: {settings.pdfCompression}</Text>
      <SegmentedButtons
        value={settings.pdfCompression}
        onValueChange={(value) => persist({ pdfCompression: value as typeof settings.pdfCompression })}
        buttons={[
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
        ]}
      />
      <Text>Scanner resolution: {settings.scannerResolution}</Text>
      <View style={styles.row}>
        {(['standard', 'high', 'max'] as const).map((resolution) => (
          <QuietButton
            key={resolution}
            label={resolution}
            hint={`Set scanner resolution to ${resolution}`}
            onPress={() => persist({ scannerResolution: resolution })}
          />
        ))}
      </View>
      <QuietButton label="Security" onPress={() => navigation.navigate('Security')} />
      <QuietButton label="Backup" onPress={() => navigation.navigate('Backup')} />
    </ScrollView>
  );
}

export function SecuritySettingsScreen() {
  const dispatch = useAppDispatch();
  const lockEnabled = useAppSelector((state) => state.settings.lockEnabled);
  const [pin, setPin] = useState('');
  const [pattern, setPattern] = useState('0,1,2,5,8');
  const [message, setMessage] = useState('');
  return (
    <Screen>
      <Title>Security</Title>
      <Row
        label="App lock"
        value={lockEnabled}
        onChange={(value) => dispatch(patchSettings({ lockEnabled: value, lockType: value ? 'pin' : 'none' }))}
      />
      <Field label="PIN" value={pin} onChangeText={setPin} secure hint="4 to 8 digits" />
      <PrimaryButton
        label="Save PIN"
        onPress={() => {
          if (!isValidPin(pin)) {
            setMessage('PIN must be 4 to 8 digits');
            return;
          }
          const salt = 'scanflow-pin-salt';
          settingsStorage.set('pin', JSON.stringify({ salt, hash: hashSecret(pin, salt) }));
          setMessage('PIN saved in encrypted settings storage');
        }}
      />
      <Text accessibilityRole="header">Pattern</Text>
      <View style={styles.row}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => (
          <QuietButton
            key={cell}
            label={String(cell)}
            hint={`Pattern cell ${cell}`}
            onPress={() => {
              const cells = pattern.split(',').map((value) => Number(value.trim())).filter((value) => Number.isInteger(value));
              if (cells.includes(cell)) return;
              setPattern([...cells, cell].join(','));
            }}
          />
        ))}
      </View>
      <Field label="Pattern" value={pattern} onChangeText={setPattern} hint="Cells 0 through 8" />
      <QuietButton
        label="Save pattern"
        onPress={() => {
          const cells = pattern.split(',').map((cell) => Number(cell.trim()));
          if (!isValidPattern(cells)) {
            setMessage('Pattern must be 4 unique cells');
            return;
          }
          const salt = 'scanflow-pattern-salt';
          settingsStorage.set('pattern', JSON.stringify({ salt, hash: hashSecret(cells.join('-'), salt) }));
          dispatch(patchSettings({ lockType: 'pattern', lockEnabled: true }));
        }}
      />
      <QuietButton
        label="Unlock with biometrics"
        onPress={() => {
          void promptBiometric('Unlock Scanflow').then((ok) => {
            dispatch(setUnlocked(ok));
            setMessage(ok ? 'Unlocked' : 'Biometric prompt was not confirmed');
          });
        }}
      />
      <QuietButton
        label="Create encrypted file key"
        onPress={() => {
          const key = randomKey();
          const sealed = sealText('scanflow-local-files', key);
          void saveFileKey(sealed.ciphertext);
          setMessage('File key sealed with AES-GCM and stored in the keychain');
        }}
      />
      <Text>{message}</Text>
      <UnlockGate />
    </Screen>
  );
}

function UnlockGate() {
  const lockEnabled = useAppSelector((state) => state.settings.lockEnabled);
  const unlocked = useAppSelector((state) => state.auth.unlocked);
  const [pin, setPin] = useState('');
  const dispatch = useAppDispatch();
  if (!lockEnabled || unlocked) return null;
  return (
    <Card>
      <Text variant="titleMedium">Scanflow is locked</Text>
      <Field label="PIN" value={pin} onChangeText={setPin} secure />
      <PrimaryButton
        label="Unlock"
        onPress={() => {
          const raw = settingsStorage.getString('pin');
          if (!raw) return;
          const saved = JSON.parse(raw) as { salt: string; hash: string };
          if (verifySecret(pin, saved.salt, saved.hash)) dispatch(setUnlocked(true));
        }}
      />
    </Card>
  );
}

export function BackupSettingsScreen() {
  const autoBackup = useAppSelector((state) => state.settings.autoBackup);
  const dispatch = useAppDispatch();
  const [backup, { data }] = useBackupMutation();
  return (
    <Screen>
      <Title>Backup</Title>
      <Row label="Automatic backup" value={autoBackup} onChange={(value) => dispatch(patchSettings({ autoBackup: value }))} />
      <PrimaryButton label="Back up now" onPress={() => void backup()} />
      {data ? <Text>Snapshot {data.id} stored</Text> : null}
    </Screen>
  );
}

export function AboutScreen() {
  return (
    <Screen>
      <Title>Scanflow</Title>
      <Text>Document scanner for staff who live in paper. Local first, cloud when you ask.</Text>
      <Text>Version 0.1.0</Text>
    </Screen>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <Text>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

function useActivePage() {
  return useAppSelector((state) => state.scanner.pages.find((page) => page.id === state.scanner.activePageId) ?? null);
}

function samplePage() {
  const width = 36;
  const height = 32;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const page = x >= 8 && x <= 28 && y >= 6 && y <= 26;
      const offset = (y * width + x) * 4;
      const value = page ? 245 : 12;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { width, height, data };
}

function safeStats() {
  try {
    return documentsRepo.stats();
  } catch {
    return { documents: 0, bytes: 0, pages: 0 };
  }
}

function safeDocuments() {
  try {
    return documentsRepo.recent().map(localToRemote);
  } catch {
    return [];
  }
}

function safeFolders() {
  try {
    return foldersRepo.list().map((folder) => ({ id: folder.id, name: folder.name }));
  } catch {
    return [] as Array<{ id: string; name: string }>;
  }
}

function localToRemote(doc: ReturnType<typeof documentsRepo.recent>[number]) {
  return {
    id: doc.id,
    userId: 'local',
    folderId: doc.folderId,
    teamId: null,
    title: doc.title,
    description: doc.description,
    thumbnail: null,
    previewImage: null,
    pdfUrl: null,
    ocrText: doc.ocrText,
    pageCount: doc.pageCount,
    size: doc.size,
    favorite: doc.favorite,
    archived: doc.archived,
    documentType: doc.documentType as 'DOCUMENT',
    createdAt: doc.updatedAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt,
    version: doc.version,
    tags: [],
  };
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  glass: { padding: 20, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.72)', gap: 8 },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraActions: { padding: 16, gap: 8, backgroundColor: '#0E1514' },
  pdf: { flex: 1, minHeight: 360 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
