# Software Detailed Design Document
## 로컬 CBCT 웹 뷰어

### 문서 정보

| 항목 | 내용 |
|------|------|
| 문서명 | Software Detailed Design Document |
| 제품명 | 로컬 CBCT 웹 뷰어 |
| 프로젝트 | PLAYG |
| Phase | EA |
| 버전 | 1.0 |

---

## 1. 소개

### 1.1 목적

본 문서는 "로컬 CBCT 웹 뷰어" 소프트웨어의 소프트웨어 상세 설계서(Software Detailed Design Document, SDS)로서, 소프트웨어 아키텍처 문서(SAD, PLAYG-2154)에 정의된 아키텍처 컴포넌트(ARCH-001 ~ ARCH-007)를 기반으로 각 모듈의 클래스/함수 수준 상세 설계를 정의한다. IEC 62304에 부합하는 SDS 구조로 작성되었다.

### 1.2 범위

본 문서는 다음 사항을 다룬다:

- 14개 소프트웨어 모듈(MOD-001 ~ MOD-014)의 상세 설계
- 각 모듈의 클래스/컴포넌트 설계, 메서드/함수 설계, 데이터 구조, 알고리즘, 에러 처리
- 모듈 간 인터페이스 상세 정의
- 단위 테스트 계획
- 요구사항 추적성 매트릭스

**적용 제외 대상**:
- 소스 코드 구현 (구현 단계에서 수행)
- 통합 테스트 및 시스템 테스트 계획

### 1.3 참조 문서

| 참조 번호 | 문서명 | 경로/비고 |
|-----------|--------|-----------|
| REF-001 | Software Requirements Specification | docs/srs.md (PLAYG-2153) |
| REF-002 | Software Architecture Document | docs/sad.md (PLAYG-2154) |
| REF-003 | ARCH-001 Rendering Pipeline Architecture | PLAYG-2299 |
| REF-004 | ARCH-002 Camera & Interaction Architecture | PLAYG-2300 |
| REF-005 | ARCH-003 Analysis Tools Architecture | PLAYG-2301 |
| REF-006 | ARCH-004 Data Layer Architecture | PLAYG-2302 |
| REF-007 | ARCH-005 Viewport Synchronization Architecture | PLAYG-2303 |
| REF-008 | ARCH-006 Security Architecture | PLAYG-2304 |
| REF-009 | ARCH-007 Frontend Application Architecture | PLAYG-2305 |


## 2. 모듈별 상세 설계

### 2.1 MOD-001: DICOM 파일 파서

**Jira 티켓**: PLAYG-2352
**관련 아키텍처**: ARCH-001 (Rendering Pipeline, Tier 1), ARCH-004 (Data Layer)
**관련 요구사항**: SW-REQ-001, SW-REQ-008

#### 2.1.1 클래스 설계

```
+----------------------------------+
|        DicomParser               |
+----------------------------------+
| - rawBuffer: ArrayBuffer         |
| - byteArray: Uint8Array          |
| - metaHeaderLength: number       |
| - transferSyntax: string         |
| - isLittleEndian: boolean        |
| - pixelData: ArrayBuffer         |
| - tags: Map<string, any>         |
+----------------------------------+
| + parse(file: File): DicomDataset|
| - validateMagicByte(): boolean   |
| - parseMetaHeader(): void        |
| - parseTags(): void              |
| - readTag(offset): DicomTag      |
| - readValue(offset, vr, len): any|
| - parsePixelData(): ArrayBuffer  |
| - validateTransferSyntax(): bool |
| - validateRequiredTags(): boolean|
| - detectEncoding(): string       |
+----------------------------------+
```

```
+----------------------------------+
|        DicomDataset              |
+----------------------------------+
| + patientInfo: PatientInfo       |
| + studyInfo: StudyInfo           |
| + seriesInfo: SeriesInfo         |
| + imageInfo: ImageInfo           |
| + pixelData: ArrayBuffer         |
| + rows: number                   |
| + columns: number                |
| + bitsAllocated: number          |
| + pixelSpacing: Vector3          |
| + imageOrientation: Vector3[]    |
| + imagePosition: Vector3         |
| + sliceThickness: number         |
| + rescaleIntercept: number       |
| + rescaleSlope: number           |
| + windowCenter: number           |
| + windowWidth: number            |
+----------------------------------+
| + validate(): ValidationResult   |
| + getPixelValue(x,y,z): number   |
+----------------------------------+
```

#### 2.1.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `parse(file: File)` | 브라우저 File 객체 | DicomDataset | DICOM 파일 전체 파싱 수행. 파일 읽기 → 매직 바이트 검증 → 메타헤더 파싱 → 태그 파싱 → 픽셀 데이터 추출 순으로 실행 |
| `validateMagicByte()` | 없음 | boolean | 파일 오프셋 128바이트 이후 4바이트가 'DICM'인지 확인. 아닐 경우 false 반환 |
| `parseMetaHeader()` | 없음 | void | File Meta Information Header 파싱. Group 0002 태그들을 읽어 전송 구문(Transfer Syntax UID) 등 메타 정보 추출 |
| `parseTags()` | 없음 | void | DICOM 데이터셋의 모든 태그를 순차 파싱. VR(Value Representation)에 따라 데이터 타입별 읽기 수행 |
| `readTag(offset: number)` | 읽기 시작 오프셋 | DicomTag | 지정된 오프셋에서 태그 그룹/요소 번호, VR, 길이, 값을 읽어 DicomTag 객체 반환 |
| `readValue(offset, vr, length)` | 오프셋, VR, 길이 | any | VR 문자열에 따라 적절한 데이터 타입(String, Number, ArrayBuffer 등)으로 값 디코딩 |
| `parsePixelData()` | 없음 | ArrayBuffer | (7FE0,0010) Pixel Data 태그의 픽셀 데이터를 추출. 압축 전송 구문의 경우 해당 디코딩 수행 |
| `validateTransferSyntax()` | 없음 | boolean | 전송 구문 UID가 지원되는지 확인. 미지원 전송 구문 시 false 반환 |
| `validateRequiredTags()` | 없음 | boolean | 필수 태그(Patient ID, Study Instance UID, Series Instance UID, SOP Instance UID, Rows, Columns, Bits Allocated, Pixel Data) 존재 여부 검증 |
| `detectEncoding()` | 없음 | string | Specific Character Set (0008,0005) 태그를 기반으로 문자 인코딩 감지 (ISO-2022-JR, UTF-8, ASCII 등) |

#### 2.1.3 데이터 구조

```typescript
interface DicomTag {
  group: number;       // 태그 그룹 번호
  element: number;     // 태그 요소 번호
  vr: string;          // Value Representation
  length: number;      // 값 길이
  value: any;          // 태그 값
}

interface PatientInfo {
  patientId: string;       // (0010,0020)
  patientName: string;     // (0010,0010)
  patientBirthDate: string;// (0010,0030)
  patientSex: string;      // (0010,0040)
}

interface StudyInfo {
  studyInstanceUid: string; // (0020,000D)
  studyDate: string;        // (0008,0020)
  studyDescription: string; // (0008,1030)
  modality: string;         // (0008,0060)
}

interface SeriesInfo {
  seriesInstanceUid: string; // (0020,000E)
  seriesNumber: number;      // (0020,0011)
}

interface ImageInfo {
  rows: number;              // (0028,0010)
  columns: number;           // (0028,0011)
  bitsAllocated: number;     // (0028,0100)
  bitsStored: number;        // (0028,0101)
  pixelRepresentation: number;// (0028,0103)
  samplesPerPixel: number;   // (0028,0002)
  photometric: string;       // (0028,0004)
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
```

#### 2.1.4 알고리즘

**DICOM 파일 파싱 알고리즘**:
```
1. FileReader로 File 객체를 ArrayBuffer로 읽기
2. 오프셋 128~131 확인 → 'DICM' 검증
   - 실패 시: 예외 발생 (유효하지 않은 DICOM 파일)
3. 메타헤더 파싱 (Group 0002)
   - 전송 구문 UID 추출
   - 바이트 오더(Little/Big Endian) 결정
   - VR 명시/암시 결정
4. 데이터셋 태그 순차 파싱
   - 각 태그: Group(2B) + Element(2B) + VR(2B) + Length(2/4B) + Value
   - 조건부 패딩 및 시퀀스(Sequence) 처리
5. 필수 태그 검증
   - 누락 시: 예외 발생 (필수 태그 누락)
6. 픽셀 데이터 추출
   - 예상 크기 = rows × columns × (bitsAllocated/8) × numberOfFrames
   - 실제 크기와 비교하여 무결성 검증
7. DicomDataset 객체 생성 및 반환
```

#### 2.1.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| 매직 바이트 불일치 | `InvalidDicomError` 발생. 사용자에게 "유효한 DICOM 파일이 아닙니다" 메시지 표시 |
| 필수 태그 누락 | `MissingRequiredTagError` 발생. 누락된 태그 목록과 함께 사용자에게 안내 |
| 미지원 전송 구문 | `UnsupportedTransferSyntaxError` 발생. 지원되는 전송 구문 목록 안내 |
| 픽셀 데이터 무결성 실패 | `PixelDataCorruptionError` 발생. 예상 크기와 실제 크기 정보 제공 |
| 파일 읽기 실패 | `FileReadError` 발생. 브라우저 권한 또는 파일 손상 안내 |
| 문자 인코딩 오류 | 기본 ASCII로 폴백. 경고 로그 기록 |

---



### 2.2 MOD-002: 전송 구문 및 문자 인코딩 처리기

**Jira 티켓**: PLAYG-2353
**관련 아키텍처**: ARCH-001 (Rendering Pipeline, Tier 1), ARCH-004 (Data Layer)
**관련 요구사항**: SW-REQ-001, SW-REQ-008

#### 2.2.1 클래스 설계

```
+----------------------------------+
|     TransferSyntaxHandler        |
+----------------------------------+
| - supportedSyntaxes: Map<string, |
|   TransferSyntaxConfig>          |
+----------------------------------+
| + isSupported(uid: string): bool |
| + getDecoder(uid: string):       |
|   PixelDecoder                   |
| + getByteOrder(uid: string):     |
|   'LE' | 'BE'                    |
| + isCompressed(uid: string): bool|
| + getSupportedList(): string[]   |
+----------------------------------+
```

```
+----------------------------------+
|     EncodingHandler              |
+----------------------------------+
| - encodingMap: Map<string,       |
|   TextDecoder>                   |
| - defaultEncoding: string        |
+----------------------------------+
| + decode(rawBytes: Uint8Array,   |
|   charset: string): string       |
| + detectCharset(tag0008_0005:    |
|   string): string                |
| + getSupportedEncodings():       |
|   string[]                       |
+----------------------------------+
```

```
+----------------------------------+
|  PixelDecoder (interface)        |
+----------------------------------+
| + decode(rawData: ArrayBuffer,   |
|   info: ImageInfo): ArrayBuffer  |
+----------------------------------+
```

```
+----------------------------------+
|  RawPixelDecoder                 |
|  implements PixelDecoder         |
+----------------------------------+
| + decode(rawData, info):         |
|   ArrayBuffer                    |
+----------------------------------+

+----------------------------------+
|  JpegLosslessDecoder             |
|  implements PixelDecoder         |
+----------------------------------+
| + decode(rawData, info):         |
|   ArrayBuffer                    |
+----------------------------------+

+----------------------------------+
|  Jpeg2000Decoder                 |
|  implements PixelDecoder         |
+----------------------------------+
| + decode(rawData, info):         |
|   ArrayBuffer                    |
+----------------------------------+

+----------------------------------+
|  RLEDecoder                      |
|  implements PixelDecoder         |
+----------------------------------+
| + decode(rawData, info):         |
|   ArrayBuffer                    |
+----------------------------------+
```

#### 2.2.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `isSupported(uid: string)` | 전송 구문 UID | boolean | 해당 전송 구문이 소프트웨어에서 지원되는지 확인 |
| `getDecoder(uid: string)` | 전송 구문 UID | PixelDecoder | 전송 구문에 맞는 픽셀 디코더 반환. 미지원 시 예외 발생 |
| `getByteOrder(uid: string)` | 전송 구문 UID | 'LE'\|'BE' | 전송 구문에 따른 바이트 오더 반환 |
| `isCompressed(uid: string)` | 전송 구문 UID | boolean | 압축 전송 구문 여부 확인 |
| `decode(rawBytes, charset)` | 원시 바이트 배열, 문자셋 | string | 지정된 문자 인코딩으로 바이트 배열을 문자열로 디코딩 |
| `detectCharset(tag0008_0005)` | Specific Character Set 태그 값 | string | DICOM 태그 값을 기반으로 문자 인코딩 이름 매핑 |

#### 2.2.3 데이터 구조

```typescript
interface TransferSyntaxConfig {
  uid: string;           // 전송 구문 UID
  name: string;          // 전송 구문명
  isExplicitVR: boolean; // VR 명시 여부
  byteOrder: 'LE' | 'BE'; // 바이트 오더
  isCompressed: boolean;  // 압축 여부
  decoderClass: typeof PixelDecoder; // 디코더 클래스
}

// 지원 전송 구문 목록
// 1.2.840.10008.1.2    : Implicit VR Little Endian
// 1.2.840.10008.1.2.1  : Explicit VR Little Endian
// 1.2.840.10008.1.2.2  : Explicit VR Big Endian
// 1.2.840.10008.1.2.4.70: JPEG Lossless (Process 14)
// 1.2.840.10008.1.2.4.90: JPEG 2000 Lossless
// 1.2.840.10008.1.2.5  : RLE Lossless
```

#### 2.2.4 알고리즘

**전송 구문 처리 알고리즘**:
```
1. DICOM 메타헤더에서 Transfer Syntax UID (0002,0010) 추출
2. supportedSyntaxes Map에서 UID 조회
3. 발견 시:
   a. byteOrder 확인 → 데이터 읽기 시 endian 적용
   b. isExplicitVR 확인 → 태그 파싱 시 VR 읽기 방식 결정
   c. isCompressed 확인 → 픽셀 데이터 디코딩 전략 선택
4. 미발견 시: UnsupportedTransferSyntaxError 발생
```

**문자 인코딩 감지 알고리즘**:
```
1. (0008,0005) Specific Character Set 태그 값 확인
2. 태그 값 → 인코딩 매핑:
   - 'ISO_IR 6' 또는 미존재 → 'ASCII'
   - 'ISO_IR 192' → 'UTF-8'
   - 'ISO 2022 IR 13\ISO 2022 IR 87' → 'ISO-2022-JP'
   - 'ISO_IR 149' → 'EUC-KR'
3. 매핑되지 않은 값 → 'ASCII' (기본값)로 폴백, 경고 로그
4. TextDecoder를 사용하여 문자열 디코딩 수행
```

#### 2.2.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| 미지원 전송 구문 | `UnsupportedTransferSyntaxError` 발생. UID와 함께 사용자에게 안내 |
| 픽셀 디코딩 실패 | `PixelDecodingError` 발생. 압축 해제 실패 원인 안내 |
| 문자 인코딩 인식 실패 | ASCII 기본값으로 폴백. 경고 로그 기록 후 계속 진행 |
| 디코더 초기화 실패 | `DecoderInitError` 발생. 메모리 부족 등 원인 안내 |

---



### 2.3 MOD-003: 볼륨 데이터 빌더

**Jira 티켓**: PLAYG-2354
**관련 아키텍처**: ARCH-001 (Rendering Pipeline, Tier 2), ARCH-004 (Data Layer)
**관련 요구사항**: SW-REQ-001, SW-REQ-002, SW-REQ-010

#### 2.3.1 클래스 설계

```
+----------------------------------+
|       VolumeBuilder              |
+----------------------------------+
| - slices: DicomDataset[]         |
| - volumeData: ArrayBuffer        |
| - dimensions: Vector3            |
| - voxelSize: Vector3             |
| - origin: Vector3                |
| - orientation: Vector3[]         |
| - loadingProgress: number        |
+----------------------------------+
| + build(slices: DicomDataset[]): |
|   VolumeData                     |
| - sortSlices(): DicomDataset[]   |
| - calculateDimensions(): Vector3 |
| - allocateVolume(): ArrayBuffer  |
| - fillVolume(): void             |
| - calculateVoxelSize(): Vector3  |
| - validateVolume(): boolean      |
| + getProgress(): number          |
+----------------------------------+
```

```
+----------------------------------+
|       VolumeData                 |
+----------------------------------+
| + data: ArrayBuffer              |
| + dimensions: Vector3            |
| + voxelSize: Vector3             |
| + origin: Vector3                |
| + orientation: Vector3[]         |
| + dataType: 'int16' | 'uint16'   |
| + windowCenter: number           |
| + windowWidth: number            |
| + rescaleIntercept: number       |
| + rescaleSlope: number           |
+----------------------------------+
| + getVoxel(x, y, z): number      |
| + setVoxel(x, y, z, val): void   |
| + getSlice(axis, index):         |
|   Float32Array                   |
| + getSubVolume(bounds):          |
|   VolumeData                     |
| + dispose(): void                |
+----------------------------------+
```

#### 2.3.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `build(slices)` | 정렬된 DicomDataset 배열 | VolumeData | 다중 DICOM 슬라이스로부터 3D 볼륨 데이터 구성. 슬라이스 정렬 → 차원 계산 → 메모리 할당 → 데이터 채우기 → 검증 순으로 실행 |
| `sortSlices()` | 없음 | DicomDataset[] | Image Position (0020,0032) 태그를 기준으로 슬라이스를 Z축 방향으로 정렬 |
| `calculateDimensions()` | 없음 | Vector3 | 첫 번째 슬라이스의 Rows, Columns과 슬라이스 개수로 x, y, z 차원 계산 |
| `allocateVolume()` | 없음 | ArrayBuffer | x × y × z × bytesPerPixel 크기의 ArrayBuffer 할당 |
| `fillVolume()` | 없음 | void | 정렬된 슬라이스의 픽셀 데이터를 볼륨 ArrayBuffer에 순차적으로 복사 |
| `calculateVoxelSize()` | 없음 | Vector3 | Pixel Spacing (0028,0030)과 Slice Thickness (0018,0050)로 체적 픽셀 크기 계산 |
| `validateVolume()` | 없음 | boolean | 볼륨 데이터 무결성 검증 (예상 크기와 실제 크기 비교, 빈 슬라이스 확인) |
| `getVoxel(x, y, z)` | 체적 좌표 | number | 지정된 위치의 볼륨 데이터 값 반환. 범위 밖이면 0 반환 |
| `getSlice(axis, index)` | 축(axial/coronal/sagittal), 인덱스 | Float32Array | 지정된 축과 인덱스에 해당하는 2D 단면 데이터 추출 |
| `dispose()` | 없음 | void | ArrayBuffer 메모리 해제. 가비지 컬렉션 유도 |

#### 2.3.3 데이터 구조

```typescript
interface VolumeData {
  data: ArrayBuffer;         // 3D 볼륨 픽셀 데이터 (Int16Array 또는 Uint16Array)
  dimensions: Vector3;       // x, y, z 차원 (예: 512, 512, 512)
  voxelSize: Vector3;        // mm 단위 체적 픽셀 크기
  origin: Vector3;           // DICOM 좌표계 원점
  orientation: Vector3[];    // Image Orientation (행/열 방향 벡터)
  dataType: 'int16' | 'uint16';
  windowCenter: number;      // 기본 Window Center
  windowWidth: number;       // 기본 Window Width
  rescaleIntercept: number;  // Rescale Intercept (0028,1052)
  rescaleSlope: number;      // Rescale Slope (0028,1053)
}
```

#### 2.3.4 알고리즘

**볼륨 구성 알고리즘**:
```
1. 입력 DicomDataset 배열의 슬라이스를 Image Position 기준으로 정렬
2. 차원 계산:
   x = firstSlice.columns
   y = firstSlice.rows
   z = sortedSlices.length
3. 체적 픽셀 크기 계산:
   voxelSize.x = pixelSpacing[0]
   voxelSize.y = pixelSpacing[1]
   voxelSize.z = sliceThickness 또는 인접 슬라이스 간 거리
4. ArrayBuffer 할당: x × y × z × 2 bytes (Int16/Uint16)
5. 슬라이스 데이터 복사:
   FOR each slice i = 0 to z-1:
     offset = i × x × y × bytesPerPixel
     COPY slice.pixelData TO volumeData AT offset
     loadingProgress = (i + 1) / z
6. 무결성 검증:
   - 예상 크기 === 실제 ArrayBuffer 크기
   - 빈 슬라이스 없음 확인
7. VolumeData 객체 생성 및 반환
```

**점진적 로딩(Progressive Loading) 알고리즘**:
```
1. 전체 볼륨의 하위 해상도 버전(예: 64³)을 먼저 생성
2. 하위 해상도 볼륨으로 초기 렌더링 시작
3. 백그라운드에서 전체 해상도 데이터를 점진적으로 로드
4. 로드 진행률에 따라 렌더링 해상도를 점진적으로 향상
5. 전체 로드 완료 시 최종 해상도 렌더링
```

#### 2.3.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| 슬라이스 개수 부족 (1개) | 단일 슬라이스로 제한된 3D 볼더 구성. 경고 메시지 표시 |
| 슬라이스 간격 불일치 | 불규칙 간격 감지 시 보간(interpolation)으로 균일 간격 재구성 |
| 메모리 할당 실패 | `MemoryAllocationError` 발생. 볼륨 크기가 시스템 한계 초과 안내 |
| 슬라이스 해상도 불일치 | 첫 번째 슬라이스 기준으로 통일. 불일치 슬라이스는 경고 후 리사이즈 |
| 픽셀 데이터 크기 불일치 | `VolumeIntegrityError` 발생. 예상/실제 크기 정보 제공 |

---



### 2.4 MOD-004: WebGL 렌더링 컨텍스트 관리자

**Jira 티켓**: PLAYG-2355
**관련 아키텍처**: ARCH-001 (Rendering Pipeline, Tier 3), ARCH-007 (Frontend Application)
**관련 요구사항**: SW-REQ-002, SW-REQ-003, SW-REQ-010, SW-REQ-011

#### 2.4.1 클래스 설계

```
+----------------------------------+
|     WebGLContextManager          |
+----------------------------------+
| - gl: WebGL2RenderingContext     |
| - canvas: HTMLCanvasElement      |
| - isContextLost: boolean         |
| - texturePool: Map<string,       |
|   WebGLTexture>                  |
| - shaderPrograms: Map<string,    |
|   WebGLProgram>                  |
| - framebuffers: Map<string,      |
|   WebGLFramebuffer>              |
+----------------------------------+
| + initialize(canvas): boolean    |
| + getContext(): WebGL2RC         |
| + createTexture(id, data, dims): |
|   WebGLTexture                   |
| + updateTexture(id, data): void  |
| + deleteTexture(id): void        |
| + createShaderProgram(id, vs, fs):|
|   WebGLProgram                   |
| + getShaderProgram(id):          |
|   WebGLProgram                   |
| + createFramebuffer(id, w, h):   |
|   WebGLFramebuffer               |
| + resize(width, height): void    |
| + clear(): void                  |
| + flush(): void                  |
| + isWebGL2Supported(): boolean   |
| + handleContextLoss(): void      |
| + restoreContext(): void         |
| + dispose(): void                |
+----------------------------------+
```

#### 2.4.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `initialize(canvas)` | HTML 캔버스 요소 | boolean | WebGL 2.0 컨텍스트 초기화. 실패 시 false 반환. 컨텍스트 손실 이벤트 리스너 등록 |
| `getContext()` | 없음 | WebGL2RenderingContext | 현재 WebGL 2.0 렌더링 컨텍스트 반환. 컨텍스트 손실 시 예외 발생 |
| `createTexture(id, data, dims)` | 텍스처 ID, 픽셀 데이터, 차원 | WebGLTexture | 3D 볼륨 데이터를 WebGL 3D 텍스처로 생성. LINEAR 필터링, CLAMP_TO_EDGE 래핑 설정 |
| `updateTexture(id, data)` | 텍스처 ID, 새 픽셀 데이터 | void | 기존 텍스처의 픽셀 데이터 업데이트. 전체 교체 방식 |
| `deleteTexture(id)` | 텍스처 ID | void | 지정된 텍스처를 GPU 메모리에서 해제 |
| `createShaderProgram(id, vs, fs)` | 프로그램 ID, 버텍스 셰이더 소스, 프래그먼트 셰이더 소스 | WebGLProgram | 셰이더 컴파일 → 프로그램 링크 → 검증. 컴파일/링크 에러 시 예외 발생 |
| `resize(width, height)` | 새 너비, 높이 | void | 캔버스 크기 변경 및 뷰포트 업데이트 |
| `handleContextLoss()` | 없음 | void | WebGL 컨텍스트 손실 처리. 모든 GPU 리소스 무효화 플래그 설정 |
| `restoreContext()` | 없음 | void | 컨텍스트 복원 후 모든 텍스처/셰이더 재생성 |
| `dispose()` | 없음 | void | 모든 GPU 리소스(텍스처, 셰이더, 프레임버퍼) 해제 |

#### 2.4.3 데이터 구조

```typescript
interface TextureConfig {
  id: string;
  target: GLenum;            // TEXTURE_3D, TEXTURE_2D
  internalFormat: GLenum;    // R16F, RG16F, RGBA8
  width: number;
  height: number;
  depth?: number;            // 3D 텍스처용
  format: GLenum;            // RED, RG, RGBA
  type: GLenum;              // FLOAT, UNSIGNED_BYTE
  filter: GLenum;            // LINEAR, NEAREST
  wrap: GLenum;              // CLAMP_TO_EDGE
}

interface ShaderConfig {
  id: string;
  vertexSource: string;
  fragmentSource: string;
  uniforms: Map<string, WebGLUniformLocation>;
  attributes: Map<string, number>;
}
```

#### 2.4.4 알고리즘

**WebGL 컨텍스트 초기화 알고리즘**:
```
1. canvas.getContext('webgl2', { antialias: false, alpha: false }) 호출
2. 컨텍스트 획득 실패 시:
   → false 반환 (WebGL 2.0 미지원)
3. 컨텍스트 손실 이벤트 리스너 등록:
   - webglcontextlost → handleContextLoss()
   - webglcontextrestored → restoreContext()
4. 기본 WebGL 상태 설정:
   - DEPTH_TEST 활성화
   - BLEND 설정 (SRC_ALPHA, ONE_MINUS_SRC_ALPHA)
   - 뷰포트 설정 (canvas.width, canvas.height)
5. 기본 셰이더 프로그램 컴파일:
   - MPR 렌더링 셰이더
   - Ray Casting 셰이더
   - 오버레이 렌더링 셰이더
6. true 반환
```

**3D 텍스처 생성 알고리즘**:
```
1. gl.createTexture() → texture 객체 생성
2. gl.bindTexture(TEXTURE_3D, texture)
3. gl.texImage3D(
     target: TEXTURE_3D,
     level: 0,
     internalFormat: R16F,
     width, height, depth,
     border: 0,
     format: RED,
     type: FLOAT,
     pixels: volumeData
   )
4. gl.texParameteri(TEXTURE_3D, TEXTURE_MIN_FILTER, LINEAR)
5. gl.texParameteri(TEXTURE_3D, TEXTURE_MAG_FILTER, LINEAR)
6. gl.texParameteri(TEXTURE_3D, TEXTURE_WRAP_S, CLAMP_TO_EDGE)
7. gl.texParameteri(TEXTURE_3D, TEXTURE_WRAP_T, CLAMP_TO_EDGE)
8. gl.texParameteri(TEXTURE_3D, TEXTURE_WRAP_R, CLAMP_TO_EDGE)
9. texturePool에 저장
```

#### 2.4.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| WebGL 2.0 미지원 | `WebGLUnsupportedError` 발생. 사용자에게 지원 브라우저 안내 |
| 컨텍스트 획득 실패 | `ContextCreationError` 발생. GPU 드라이버 문제 가능성 안내 |
| 셰이더 컴파일 실패 | `ShaderCompileError` 발생. 셰이더 로그와 함께 에러 정보 제공 |
| 텍스처 생성 실패 (메모리 부족) | `GPUOutOfMemoryError` 발생. 볼륨 크기 축소 권장 |
| 컨텍스트 손실 | 자동 복원 시도. 복원 중 "렌더링을 복원하고 있습니다" 안내 표시 |

---



### 2.5 MOD-005: MPR 렌더러

**Jira 티켓**: PLAYG-2356
**관련 아키텍처**: ARCH-001 (Rendering Pipeline, Tier 3)
**관련 요구사항**: SW-REQ-002, SW-REQ-005, SW-REQ-010

#### 2.5.1 클래스 설계

```
+----------------------------------+
|         MprRenderer              |
+----------------------------------+
| - gl: WebGL2RenderingContext     |
| - shaderProgram: WebGLProgram    |
| - volumeTexture: WebGLTexture    |
| - viewports: Map<Axis,           |
|   MprViewport>                  |
| - currentPosition: Vector3       |
| - wlww: { center, width }        |
| - interpolation: 'linear' |      |
|   'nearest'                      |
+----------------------------------+
| + initialize(gl, volumeTex): void|
| + render(axis: Axis): void       |
| + renderAll(): void              |
| + setPosition(pos: Vector3): void|
| + getPosition(): Vector3         |
| + setWindowLevel(center, width): |
|   void                           |
| + setInterpolation(mode): void   |
| + resizeViewport(axis, w, h):    |
|   void                           |
| + getViewportImage(axis):        |
|   ImageData                      |
+----------------------------------+
```

```
+----------------------------------+
|      MprViewport                 |
+----------------------------------+
| + axis: Axis                     |
| + canvas: HTMLCanvasElement      |
| + x: number                      |
| + y: number                      |
| + width: number                  |
| + height: number                 |
| + quadVAO: WebGLVertexArrayObject|
+----------------------------------+
```

```typescript
type Axis = 'axial' | 'coronal' | 'sagittal';
```

#### 2.5.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `initialize(gl, volumeTex)` | WebGL 컨텍스트, 볼륨 텍스처 | void | MPR 셰이더 프로그램 컴파일, 화면 사각형 VAO 생성, 각 축별 뷰포트 초기화 |
| `render(axis)` | 축 (axial/coronal/sagittal) | void | 지정된 축의 단면 렌더링. 셰이더 uniform 설정 → 단면 위치 설정 → 드로우 콜 |
| `renderAll()` | 없음 | void | 3개 축(Axial, Coronal, Sagittal) 모두 렌더링 |
| `setPosition(pos)` | 3D 위치 벡터 | void | 단면 위치 업데이트 후 각 축 렌더링 트리거 |
| `setWindowLevel(center, width)` | WL 중심, WW 폭 | void | Window Level/Width 값 업데이트. 셰이더 uniform 갱신 후 재렌더링 |
| `setInterpolation(mode)` | 보간 모드 | void | 텍스처 필터링 모드 변경 (LINEAR/NEAREST). 해부학적 구조 왜곡 방지를 위해 기본값 LINEAR |
| `getViewportImage(axis)` | 축 | ImageData | 지정된 축의 현재 렌더링 결과를 ImageData로 반환 (비교/검증용) |

#### 2.5.3 데이터 구조

```typescript
interface MprUniforms {
  u_volumeTexture: WebGLUniformLocation;
  u_slicePosition: WebGLUniformLocation;  // 단면 위치 (0.0 ~ 1.0)
  u_windowCenter: WebGLUniformLocation;
  u_windowWidth: WebGLUniformLocation;
  u_volumeDimensions: WebGLUniformLocation;
  u_viewportSize: WebGLUniformLocation;
}

// MPR 프래그먼트 셰이더 핵심 로직:
// 1. 볼륨 텍스처에서 현재 단면 위치의 텍셀 샘플링
// 2. WL/WW 선형 매핑 적용
// 3. 한계값(Clipping) 처리
```

#### 2.5.4 알고리즘

**MPR 단면 렌더링 알고리즘**:
```
1. 현재 축에 따른 샘플링 방향 결정:
   - Axial: slicePosition.z 고정, x-y 평면 샘플링
   - Coronal: slicePosition.y 고정, x-z 평면 샘플링
   - Sagittal: slicePosition.x 고정, y-z 평면 샘플링
2. 셰이더 uniform 설정:
   u_volumeTexture = 0 (텍스처 유닛 0)
   u_slicePosition = currentPosition.axisComponent / dimensions.axisComponent
   u_windowCenter = wlww.center
   u_windowWidth = wlww.width
   u_volumeDimensions = dimensions
3. 전체 화면 사각형 드로우 콜 (gl.drawArrays(TRIANGLE_STRIP, 0, 4))
4. 프래그먼트 셰이더에서:
   a. 볼륨 텍스처 3D 샘플링 (textureLod)
   b. 원시 값에 rescaleSlope, rescaleIntercept 적용
   c. WL/WW 선형 매핑:
      normalizedValue = (voxelValue - center + width/2) / width
   d. Clipping:
      clampedValue = clamp(normalizedValue, 0.0, 1.0)
   e. 그레이스케일 출력: vec4(clampedValue, clampedValue, clampedValue, 1.0)
```

**WL/WW 선형 매핑 알고리즘**:
```
입력: voxelValue (HU), windowCenter (C), windowWidth (W)
출력: normalizedValue (0.0 ~ 1.0)

lowerBound = C - W / 2
upperBound = C + W / 2

if voxelValue <= lowerBound:
  return 0.0 (검정)
else if voxelValue >= upperBound:
  return 1.0 (흰색)
else:
  return (voxelValue - lowerBound) / W
```

#### 2.5.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| 볼륨 텍스처 미초기화 | 렌더링 건너뛰기. 경고 로그 기록 |
| 단면 위치 범위 초과 | clamp(0.0, 1.0)로 자동 보정 |
| 셰이더 uniform 설정 실패 | `ShaderUniformError` 발생. 셰이더 프로그램 재컴파일 시도 |
| 프레임률 저하 (30fps 미만) | 렌더링 해상도 자동 축소 후 점진적 복원 |

---



### 2.6 MOD-006: 3D 볼륨 렌더러

**Jira 티켓**: PLAYG-2357
**관련 아키텍처**: ARCH-001 (Rendering Pipeline, Tier 3)
**관련 요구사항**: SW-REQ-003, SW-REQ-010

#### 2.6.1 클래스 설계

```
+----------------------------------+
|     VolumeRenderer               |
+----------------------------------+
| - gl: WebGL2RenderingContext     |
| - shaderProgram: WebGLProgram    |
| - volumeTexture: WebGLTexture    |
| - transferFunction: TransferFunc |
| - camera: CameraModel            |
| - renderQuality: 'low' | 'medium'|
|   | 'high'                       |
| - canvas: HTMLCanvasElement      |
| - isRendering: boolean           |
+----------------------------------+
| + initialize(gl, volumeTex): void|
| + render(): void                 |
| + setTransferFunction(tf): void  |
| + updateTransferTexture(): void  |
| + setCamera(camera): void        |
| + setQuality(level): void        |
| + getFrameRate(): number         |
| + startRenderLoop(): void        |
| + stopRenderLoop(): void         |
+----------------------------------+
```

```
+----------------------------------+
|     TransferFunction             |
+----------------------------------+
| - controlPoints: ControlPoint[]  |
| - colorTexture: WebGLTexture     |
| - opacityTexture: WebGLTexture   |
+----------------------------------+
| + addControlPoint(cp): void      |
| + removeControlPoint(index): void|
| + updateControlPoint(i, cp): void|
| + getColor(value): RGBA          |
| + getOpacity(value): number      |
| + buildTexture(gl): void         |
| + getPreset(name): TransferFunc  |
+----------------------------------+
```

```
+----------------------------------+
|     ControlPoint                 |
+----------------------------------+
| + position: number (0.0~1.0)     |
| + color: RGBA                    |
| + opacity: number (0.0~1.0)      |
+----------------------------------+
```

#### 2.6.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `initialize(gl, volumeTex)` | WebGL 컨텍스트, 볼륨 텍스처 | void | Ray Casting 셰이더 컴파일, 전송 함수 텍스처 초기화, 바운딩 박스 VAO 생성 |
| `render()` | 없음 | void | Ray Casting 기반 3D 볼륨 렌더링 수행. 카메라 행렬 설정 → 레이 방향 계산 → 볼륨 샘플링 → 합성 |
| `setTransferFunction(tf)` | 전송 함수 객체 | void | 전송 함수 업데이트. 색상/불투명도 텍스처 재생성 후 즉시 재렌더링 |
| `updateTransferTexture()` | 없음 | void | 전송 함수 제어점을 기반으로 1D 텍스처(색상, 불투명도) 재생성 |
| `setQuality(level)` | 렌더링 품질 수준 | void | 레이 샘플링 스텝 크기 조정. low(512스텝), medium(256스텝), high(128스텝) |
| `startRenderLoop()` | 없음 | void | requestAnimationFrame 기반 렌더 루프 시작 |
| `stopRenderLoop()` | 없음 | void | 렌더 루프 중지 |

#### 2.6.3 데이터 구조

```typescript
interface RGBA {
  r: number; // 0.0 ~ 1.0
  g: number;
  b: number;
  a: number;
}

interface RayCastingUniforms {
  u_volumeTexture: WebGLUniformLocation;
  u_transferColor: WebGLUniformLocation;
  u_transferOpacity: WebGLUniformLocation;
  u_viewMatrix: WebGLUniformLocation;
  u_projectionMatrix: WebGLUniformLocation;
  u_cameraPosition: WebGLUniformLocation;
  u_volumeMin: WebGLUniformLocation;
  u_volumeMax: WebGLUniformLocation;
  u_stepSize: WebGLUniformLocation;
  u_lightDirection: WebGLUniformLocation;
}

// 기본 전송 함수 프리셋: CBCT용
// - 공기(air): 투명 (opacity: 0.0)
// - 연조직(soft tissue): 연한 빨강 (opacity: 0.1~0.3)
// - 골조직(bone): 흰색/밝은 회색 (opacity: 0.5~0.9)
// - 치아(enamel/dentin): 밝은 노랑 (opacity: 0.7~1.0)
```

#### 2.6.4 알고리즘

**Ray Casting 볼륨 렌더링 알고리즘**:
```
[프래그먼트 셰이더 수행]

1. 바운딩 박스 교차 계산:
   - 현재 픽셀의 카메라 위치에서 레이 방향 계산
   - 레이와 볼륨 바운딩 박스의 교차점(tNear, tFar) 계산

2. 레이 마칭 (Ray Marching):
   FOR t = tNear TO tFar STEP stepSize:
     a. 현재 샘플링 위치 계산: pos = rayOrigin + t * rayDirection
     b. 볼륨 텍스처에서 밀도값 샘플링: density = texture(volumeTex, pos).r
     c. 정규화: normalizedDensity = (density - min) / (max - min)
     d. 전송 함수 조회:
        color = texture(transferColor, normalizedDensity).rgb
        opacity = texture(transferOpacity, normalizedDensity).a
     e. 전후 합성 (Front-to-Back Compositing):
        accumulatedColor += (1.0 - accumulatedAlpha) * color * opacity
        accumulatedAlpha += (1.0 - accumulatedAlpha) * opacity
     f. 조명 계산 (Phong 모델):
        gradient = computeGradient(volumeTex, pos)
        diffuse = max(dot(normalize(gradient), lightDir), 0.0)
     g. Early Ray Termination:
        IF accumulatedAlpha > 0.95: BREAK

3. 최종 색상 반환: vec4(accumulatedColor, accumulatedAlpha)
```

**그래디언트 계산 알고리즘 (법선 벡터)**:
```
중앙 차분법(Central Difference):
gradient.x = (voxel(x+1,y,z) - voxel(x-1,y,z)) / (2 * voxelSize.x)
gradient.y = (voxel(x,y+1,z) - voxel(x,y-1,z)) / (2 * voxelSize.y)
gradient.z = (voxel(x,y,z+1) - voxel(x,y,z-1)) / (2 * voxelSize.z)
return normalize(gradient)
```

#### 2.6.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| 볼륨 텍스처 미설정 | 빈 화면 렌더링. "볼륨 데이터를 로드해주세요" 안내 |
| 전송 함수 텍스처 생성 실패 | 기본 프리셋(CBCT Bone)으로 폴백 |
| 프레임률 저하 (15fps 미만) | 렌더링 품질을 자동으로 낮춤 (샘플링 스텝 증가) |
| 레이가 볼륨을 통과하지 않음 | 투명 픽셀 출력 (배경색) |

---



### 2.7 MOD-007: 카메라 시스템

**Jira 티켓**: PLAYG-2358
**관련 아키텍처**: ARCH-002 (Camera & Interaction)
**관련 요구사항**: SW-REQ-004

#### 2.7.1 클래스 설계

```
+----------------------------------+
|        CameraModel               |
+----------------------------------+
| - target: Vector3                |
| - distance: number               |
| - rotation: Quaternion           |
| - fov: number                    |
| - near: number                   |
| - far: number                    |
| - aspectRatio: number            |
| - viewMatrix: Matrix4            |
| - projectionMatrix: Matrix4      |
| - initialTarget: Vector3         |
| - initialDistance: number         |
| - initialRotation: Quaternion    |
+----------------------------------+
| + getViewMatrix(): Matrix4       |
| + getProjectionMatrix(): Matrix4 |
| + rotate(deltaX, deltaY): void   |
| + zoom(delta: number): void      |
| + pan(deltaX, deltaY): void      |
| + reset(): void                  |
| + setPosition(pos: Vector3): void|
| + getPosition(): Vector3         |
| + lookAt(target: Vector3): void  |
| + updateMatrices(): void         |
+----------------------------------+
```

```
+----------------------------------+
|        Quaternion                |
+----------------------------------+
| + x: number                      |
| + y: number                      |
| + z: number                      |
| + w: number                      |
+----------------------------------+
| + multiply(q: Quaternion):       |
|   Quaternion                     |
| + normalize(): Quaternion        |
| + conjugate(): Quaternion        |
| + toMatrix4(): Matrix4           |
| + fromAxisAngle(axis, angle):    |
|   Quaternion                     |
| + slerp(q, t): Quaternion        |
| + identity(): Quaternion         |
+----------------------------------+
```

```
+----------------------------------+
|        Matrix4                   |
+----------------------------------+
| + elements: Float32Array (16)    |
+----------------------------------+
| + multiply(m: Matrix4): Matrix4  |
| + inverse(): Matrix4             |
| + transpose(): Matrix4           |
| + perspective(fov, aspect, near, |
|   far): Matrix4                  |
| + lookAt(eye, target, up):       |
|   Matrix4                        |
| + identity(): Matrix4            |
+----------------------------------+
```

#### 2.7.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `getViewMatrix()` | 없음 | Matrix4 | 현재 카메라 상태(타겟, 거리, 회전)로부터 뷰 행렬 계산 |
| `getProjectionMatrix()` | 없음 | Matrix4 | FOV, 종횡비, near/far로부터 투영 행렬 계산 |
| `rotate(deltaX, deltaY)` | 마우스 이동량 (x, y) | void | 쿼터니언 기반 궤도 회전. deltaX → Y축 회전, deltaY → X축 회전. 수치 오차 누적 방지를 위해 매번 정규화 |
| `zoom(delta)` | 줌 변화량 | void | 타겟까지의 거리 조정. 최소/최대 거리 제한 적용 |
| `pan(deltaX, deltaY)` | 팬 이동량 (x, y) | void | 카메라 타겟 위치를 카메라 로컬 좌표계에서 이동 |
| `reset()` | 없음 | void | 초기 카메라 상태(initialTarget, initialDistance, initialRotation)로 복원 |
| `lookAt(target)` | 타겟 위치 | void | 카메라가 지정된 타겟을 바라보도록 회전 값 재계산 |
| `updateMatrices()` | 없음 | void | 현재 상태로부터 뷰 행렬과 투영 행렬을 재계산 |

#### 2.7.3 데이터 구조

```typescript
interface CameraState {
  target: Vector3;       // 카메라가 바라보는 중심점
  distance: number;      // 타겟으로부터의 거리
  rotation: Quaternion;  // 현재 회전 상태
  fov: number;           // 수직 시야각 (라디안)
  aspectRatio: number;   // 종횡비
  near: number;          // 근평면 거리
  far: number;           // 원평면 거리
}

// 카메라 제약 상수
const CAMERA_CONSTANTS = {
  MIN_DISTANCE: 0.1,
  MAX_DISTANCE: 10.0,
  MIN_FOV: 0.1,           // 라디안
  MAX_FOV: Math.PI / 2,
  ROTATION_SENSITIVITY: 0.005,
  ZOOM_SENSITIVITY: 0.001,
  PAN_SENSITIVITY: 0.002,
};
```

#### 2.7.4 알고리즘

**궤도형 카메라 회전 알고리즘 (쿼터니언 기반)**:
```
1. 마우스 이동량(deltaX, deltaY)을 회전 각도로 변환:
   angleX = deltaX * ROTATION_SENSITIVITY
   angleY = deltaY * ROTATION_SENSITIVITY

2. 회전 쿼터니언 생성:
   qX = Quaternion.fromAxisAngle(Vector3.UP, angleX)
   qY = Quaternion.fromAxisAngle(Vector3.RIGHT, angleY)

3. 현재 회전에 누적:
   rotation = qX * rotation * qY

4. 수치 오차 방지를 위한 정규화:
   rotation = rotation.normalize()

5. 행렬 재계산:
   updateMatrices()
```

**뷰 행렬 계산 알고리즘**:
```
1. 카메라 위치 계산:
   offset = rotation * Vector3.FORWARD * distance
   eye = target + offset

2. 뷰 행렬 생성:
   viewMatrix = Matrix4.lookAt(eye, target, Vector3.UP)

3. rotation.toMatrix4()와 결합하여 최종 행렬 생성
```

**줌(Zoom) 알고리즘**:
```
1. 새 거리 계산:
   newDistance = distance - delta * ZOOM_SENSITIVITY * distance

2. 범위 제한:
   newDistance = clamp(newDistance, MIN_DISTANCE, MAX_DISTANCE)

3. 업데이트:
   distance = newDistance
   updateMatrices()
```

#### 2.7.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| 거리 한계 초과 | MIN_DISTANCE, MAX_DISTANCE로 자동 clamp |
| 쿼터니언 노름(norm) 0 | 단위 쿼터니언(Identity)으로 리셋 |
| 투영 행렬 특이점(singular) | near/far 값 보정 후 재계산 |
| 회전 값 NaN | 단위 쿼터니언으로 리셋. 경고 로그 기록 |

---



### 2.8 MOD-008: 입력 핸들러

**Jira 티켓**: PLAYG-2359
**관련 아키텍처**: ARCH-002 (Camera & Interaction)
**관련 요구사항**: SW-REQ-004

#### 2.8.1 클래스 설계

```
+----------------------------------+
|       InputHandler               |
+----------------------------------+
| - canvas: HTMLCanvasElement      |
| - activeInputs: Map<string,      |
|   InputState>                    |
| - callbacks: Map<string,         |
|   Function[]>                    |
| - isEnabled: boolean             |
| - modifierKeys: ModifierState    |
+----------------------------------+
| + initialize(canvas): void       |
| + enable(): void                 |
| + disable(): void                |
| + on(event: string, cb): void    |
| + off(event: string, cb): void   |
| - handleMouseDown(e): void       |
| - handleMouseMove(e): void       |
| - handleMouseUp(e): void         |
| - handleWheel(e): void           |
| - handleTouchStart(e): void      |
| - handleTouchMove(e): void       |
| - handleTouchEnd(e): void        |
| - handleKeyDown(e): void         |
| - handleKeyUp(e): void           |
| - emit(event: string, data): void|
| + destroy(): void                |
+----------------------------------+
```

```
+----------------------------------+
|       InputState                 |
+----------------------------------+
| + type: 'mouse' | 'touch'        |
| + startX: number                 |
| + startY: number                 |
| + currentX: number               |
| + currentY: number               |
| + button: number                 |
| + isActive: boolean              |
+----------------------------------+
```

#### 2.8.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `initialize(canvas)` | HTML 캔버스 요소 | void | 캔버스에 마우스/터치/키보드 이벤트 리스너 등록 |
| `enable()` / `disable()` | 없음 | void | 입력 처리 활성화/비활성화 |
| `on(event, cb)` | 이벤트명, 콜백 함수 | void | 이벤트 콜백 등록. 지원 이벤트: 'rotate', 'zoom', 'pan', 'click', 'keydown', 'keyup' |
| `off(event, cb)` | 이벤트명, 콜백 함수 | void | 등록된 이벤트 콜백 제거 |
| `handleMouseDown(e)` | MouseEvent | void | 마우스 버튼 상태 기록. 입력 상태 활성화 |
| `handleMouseMove(e)` | MouseEvent | void | 활성 입력 상태에 따라 rotate/pan 이벤트 emit. deltaX, deltaY 계산 |
| `handleWheel(e)` | WheelEvent | void | 스크롤 델타를 줌 이벤트로 변환하여 emit |
| `handleTouchStart(e)` | TouchEvent | void | 터치 포인트 수에 따라 제스처 모드 결정 (1: 회전, 2: 핀치줌/팬) |
| `handleTouchMove(e)` | TouchEvent | void | 터치 제스처 분석 후 대응하는 이벤트 emit |
| `handleKeyDown/Up(e)` | KeyboardEvent | void | 보조키(Shift, Ctrl, Alt) 상태 추적. 단축키 이벤트 emit |
| `destroy()` | 없음 | void | 모든 이벤트 리스너 제거 |

#### 2.8.3 데이터 구조

```typescript
interface ModifierState {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
}

// 이벤트 데이터 형식
interface RotateEventData {
  deltaX: number;
  deltaY: number;
  modifiers: ModifierState;
}

interface ZoomEventData {
  delta: number;
  x: number;  // 줌 중심점 x
  y: number;  // 줌 중심점 y
  modifiers: ModifierState;
}

interface PanEventData {
  deltaX: number;
  deltaY: number;
  modifiers: ModifierState;
}

interface ClickEventData {
  x: number;
  y: number;
  button: number;
  modifiers: ModifierState;
}

// 지원 이벤트 타입
type InputEvent = 'rotate' | 'zoom' | 'pan' | 'click' | 'keydown' | 'keyup';
```

#### 2.8.4 알고리즘

**마우스 입력 처리 알고리즘**:
```
1. MouseDown:
   - activeInputs['mouse'] = { startX: e.clientX, startY: e.clientY, button: e.button, isActive: true }
   - modifierKeys 업데이트

2. MouseMove (isActive):
   deltaX = e.clientX - startX
   deltaY = e.clientY - startY
   IF button === 0 (좌클릭) AND !shift AND !ctrl:
     emit('rotate', { deltaX, deltaY, modifiers })
   ELSE IF button === 0 AND shift:
     emit('pan', { deltaX, deltaY, modifiers })
   ELSE IF button === 1 (중간 버튼):
     emit('pan', { deltaX, deltaY, modifiers })
   startX = e.clientX, startY = e.clientY

3. MouseUp:
   activeInputs['mouse'].isActive = false
```

**터치 입력 처리 알고리즘**:
```
1. TouchStart:
   IF touches.length === 1:
     mode = 'rotate'
     기준점 = touches[0]
   ELSE IF touches.length === 2:
     mode = 'pinch-zoom'
     초기 핀치 거리 = distance(touches[0], touches[1])
     초기 핀치 중심 = midpoint(touches[0], touches[1])

2. TouchMove:
   IF mode === 'rotate':
     deltaX = touches[0].clientX - 기준점.x
     deltaY = touches[0].clientY - 기준점.y
     emit('rotate', { deltaX, deltaY })
   ELSE IF mode === 'pinch-zoom':
     현재 핀치 거리 = distance(touches[0], touches[1])
     delta = 현재 거리 - 초기 거리
     emit('zoom', { delta })
     팬 성분 계산 후 emit('pan', ...)

3. TouchEnd:
   touches.length < 2 → mode 리셋
   touches.length === 0 → 모든 입력 종료
```

#### 2.8.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| 캔버스 요소 미존재 | `CanvasNotFoundError` 발생. 초기화 중단 |
| 이벤트 리스너 등록 실패 | 경고 로그 기록 후 대체 입력 모드 시도 |
| 터치 이벤트 미지원 | 마우스 전용 모드로 전환. 경고 로그 기록 |
| 다중 입력 충돌 | 가장 최근 입력을 우선 처리. 이전 입력 상태 초기화 |

---



### 2.9 MOD-009: 측정 도구 엔진

**Jira 티켓**: PLAYG-2360
**관련 아키텍처**: ARCH-003 (Analysis Tools)
**관련 요구사항**: SW-REQ-006, SW-REQ-007

#### 2.9.1 클래스 설계

```
+----------------------------------+
|     MeasurementEngine            |
+----------------------------------+
| - tools: Map<string, Tool>       |
| - activeTool: string             |
| - measurements: Measurement[]    |
| - coordinateMapper: CoordMapper  |
| - overlayRenderer: OverlayRenderer|
| - pixelSpacing: Vector2          |
| - hasPixelSpacing: boolean       |
+----------------------------------+
| + registerTool(tool: Tool): void |
| + setActiveTool(id: string): void|
| + getActiveTool(): Tool          |
| + addPoint(point: ScreenPoint):  |
|   void                           |
| + removeMeasurement(id): void    |
| + clearAll(): void               |
| + getMeasurements(): Measurement[]|
| + calculateDistance(p1, p2):     |
|   number                         |
| + calculateAngle(p1, p2, p3):    |
|   number                         |
| + setPixelSpacing(sp: Vector2):  |
|   void                           |
+----------------------------------+
```

```
+----------------------------------+
|     Tool (interface)             |
+----------------------------------+
| + id: string                     |
| + name: string                   |
| + requiredPoints: number         |
| + onPointAdded(index, point):    |
|   Measurement                    |
| + render(ctx, measurement): void |
+----------------------------------+

+----------------------------------+
| DistanceTool implements Tool     |
+----------------------------------+
| requiredPoints: 2                |
| onPointAdded: 거리 계산          |
| render: 선분 + 수치 표시         |
+----------------------------------+

+----------------------------------+
| AngleTool implements Tool        |
+----------------------------------+
| requiredPoints: 3                |
| onPointAdded: 각도 계산          |
| render: 각도선 + 수치 표시       |
+----------------------------------+

+----------------------------------+
| RoiTool implements Tool          |
+----------------------------------+
| requiredPoints: varies           |
| onPointAdded: ROI 생성           |
| render: ROI 영역 표시            |
+----------------------------------+
```

```
+----------------------------------+
|     Measurement                  |
+----------------------------------+
| + id: string                     |
| + toolType: string               |
| + points: ScreenPoint[]          |
| + result: number                 |
| + unit: string                   |
| + axis: Axis                     |
| + sliceIndex: number             |
| + timestamp: Date                |
+----------------------------------+
```

#### 2.9.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `registerTool(tool)` | Tool 객체 | void | 측정 도구를 레지스트리에 등록 |
| `setActiveTool(id)` | 도구 ID | void | 활성 도구 변경. 이전 측정 완료/취소 처리 |
| `addPoint(point)` | 화면 좌표 | void | 활성 도구에 측정 포인트 추가. 필요 포인트 수 충족 시 측정 완료 |
| `calculateDistance(p1, p2)` | 두 화면 좌표 | number | 두 점 사이의 거리를 Pixel Spacing 기반 mm 단위로 계산. Pixel Spacing 누락 시 픽셀 단위 |
| `calculateAngle(p1, p2, p3)` | 세 화면 좌표 | number | p2를 꼭지점으로 하는 세 점의 각도를 도(degree) 단위로 계산 |
| `setPixelSpacing(sp)` | Pixel Spacing (x, y) | void | DICOM Pixel Spacing 값 설정. 누락 시 hasPixelSpacing = false로 설정 |

#### 2.9.3 데이터 구조

```typescript
interface ScreenPoint {
  x: number;  // 화면 X 좌표
  y: number;  // 화면 Y 좌표
}

interface VolumePoint {
  x: number;  // 볼륨 X 인덱스
  y: number;  // 볼륨 Y 인덱스
  z: number;  // 볼륨 Z 인덱스
}

interface Measurement {
  id: string;
  toolType: 'distance' | 'angle' | 'roi-rect' | 'roi-circle' | 'roi-free';
  points: ScreenPoint[];
  volumePoints: VolumePoint[];
  result: number;
  unit: 'mm' | 'degree' | 'px' | 'px²';
  axis: Axis;
  sliceIndex: number;
  timestamp: Date;
}
```

#### 2.9.4 알고리즘

**거리 측정 알고리즘**:
```
1. 화면 좌표를 볼륨 좌표로 변환:
   vp1 = coordinateMapper.screenToVolume(p1)
   vp2 = coordinateMapper.screenToVolume(p2)

2. 픽셀 거리 계산:
   dx = (vp2.x - vp1.x) * pixelSpacing.x
   dy = (vp2.y - vp1.y) * pixelSpacing.y

3. mm 단위 거리:
   distance = sqrt(dx² + dy²)

4. 결과 포맷:
   result = round(distance, 2)  // 소수점 둘째 자리
   unit = 'mm' (hasPixelSpacing) 또는 'px' (!hasPixelSpacing)
```

**각도 측정 알고리즘**:
```
1. 세 점의 볼륨 좌표 변환: vp1, vp2, vp3
   (p2가 꼭지점)

2. 두 벡터 계산:
   v1 = vp1 - vp2
   v2 = vp3 - vp2

3. 내적과 외적:
   dot = v1.x * v2.x + v1.y * v2.y
   cross = v1.x * v2.y - v1.y * v2.x

4. 각도 계산:
   angle = atan2(|cross|, dot)  // 라디안
   angleDeg = angle * (180 / PI)

5. 결과 포맷:
   result = round(angleDeg, 2)
   unit = 'degree'
```

**Pixel Spacing 누락 처리 알고리즘**:
```
1. DICOM Pixel Spacing (0028,0030) 태그 확인
2. 태그 존재 시:
   pixelSpacing = tagValue
   hasPixelSpacing = true
   unit = 'mm'
3. 태그 누락 시:
   hasPixelSpacing = false
   unit = 'px'
   사용자에게 경고 표시:
   "Pixel Spacing 정보가 없어 픽셀 단위로 표시됩니다"
```

#### 2.9.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| Pixel Spacing 누락 | 픽셀 단위로 폴백. 사용자에게 경고 표시 |
| 측정 포인트 불충분 | 대기 상태 유지. 추가 포인트 입력 요구 |
| 동일 위치 클릭 (거리 0) | 경고 메시지 "다른 위치를 선택하세요" |
| 코사인/사인 값 범위 초과 | clamp(-1, 1) 적용 후 계산 |
| 볼륨 좌표 변환 실패 | 측정 취소. 오류 메시지 표시 |

---



### 2.10 MOD-010: 오버레이 렌더러

**Jira 티켓**: PLAYG-2361
**관련 아키텍처**: ARCH-003 (Analysis Tools)
**관련 요구사항**: SW-REQ-006, SW-REQ-007

#### 2.10.1 클래스 설계

```
+----------------------------------+
|     OverlayRenderer              |
+----------------------------------+
| - canvas: HTMLCanvasElement      |
| - ctx: CanvasRenderingContext2D  |
| - overlayItems: Map<string,      |
|   OverlayItem>                   |
| - currentAxis: Axis              |
| - currentSliceIndex: number      |
| - viewportTransform: Matrix3     |
+----------------------------------+
| + initialize(canvas): void       |
| + addItem(id: string, item): void|
| + removeItem(id: string): void   |
| + updateItem(id, updates): void  |
| + render(): void                 |
| + clear(): void                  |
| + setViewport(axis, sliceIdx):   |
|   void                           |
| + setTransform(transform): void  |
| + drawLine(p1, p2, style): void  |
| + drawAngle(p1, p2, p3, style):  |
|   void                           |
| + drawRect(bounds, style): void  |
| + drawCircle(center, r, style):  |
|   void                           |
| + drawFreehand(points, style):   |
|   void                           |
| + drawText(pos, text, style):    |
|   void                           |
+----------------------------------+
```

#### 2.10.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `initialize(canvas)` | HTML 캔버스 요소 | void | 2D 캔버스 컨텍스트 초기화. 오버레이 전용 캔버스 설정 |
| `addItem(id, item)` | 항목 ID, OverlayItem | void | 오버레이 항목 추가. 항목은 측정선, ROI 영역 등 |
| `removeItem(id)` | 항목 ID | void | 지정된 오버레이 항목 제거 |
| `render()` | 없음 | void | 현재 뷰포트(축, 슬라이스 인덱스)에 해당하는 모든 오버레이 항목 렌더링 |
| `setViewport(axis, sliceIdx)` | 축, 슬라이스 인덱스 | void | 현재 표시 중인 뷰포트 정보 설정. 해당 뷰포트의 오버레이만 표시 |
| `setTransform(transform)` | 변환 행렬 | void | 화면 해상도 변경 시 오버레이 좌표 변환 행렬 업데이트 |
| `drawLine(p1, p2, style)` | 두 점, 스타일 | void | 측정선 렌더링. 끝점 마커와 거리 수치 표시 |
| `drawAngle(p1, p2, p3, style)` | 세 점, 스타일 | void | 각도 측정선 렌더링. 호(arc) 표시 및 각도 수치 표시 |
| `drawRect(bounds, style)` | 사각형 영역, 스타일 | void | 사각형 ROI 렌더링 |
| `drawCircle(center, r, style)` | 중심, 반지름, 스타일 | void | 원형 ROI 렌더링 |
| `drawFreehand(points, style)` | 점 배열, 스타일 | void | 자유곡선 ROI 렌더링 |
| `drawText(pos, text, style)` | 위치, 텍스트, 스타일 | void | 측정 결과 텍스트 렌더링 (소수점 둘째 자리) |

#### 2.10.3 데이터 구조

```typescript
interface OverlayItem {
  id: string;
  type: 'distance-line' | 'angle-line' | 'roi-rect' | 'roi-circle' | 'roi-free';
  points: ScreenPoint[];
  axis: Axis;
  sliceIndex: number;
  style: OverlayStyle;
  label: string;
  visible: boolean;
}

interface OverlayStyle {
  strokeColor: string;    // 예: '#00FF00'
  strokeWidth: number;    // 예: 2
  fillColor: string;      // 예: 'rgba(0, 255, 0, 0.1)'
  font: string;           // 예: '14px sans-serif'
  textColor: string;      // 예: '#FFFFFF'
  textBackground: string; // 예: 'rgba(0, 0, 0, 0.7)'
}

// 기본 스타일 상수
const DEFAULT_STYLES = {
  distance: { strokeColor: '#00FF00', strokeWidth: 2, textColor: '#FFFFFF' },
  angle:    { strokeColor: '#FFFF00', strokeWidth: 2, textColor: '#FFFFFF' },
  roi:      { strokeColor: '#FF6600', strokeWidth: 2, fillColor: 'rgba(255, 102, 0, 0.1)' },
};
```

#### 2.10.4 알고리즘

**오버레이 렌더링 알고리즘**:
```
1. 캔버스 초기화: ctx.clearRect(0, 0, width, height)
2. 뷰포트 변환 행렬 적용: ctx.setTransform(viewportTransform)
3. 현재 축 및 슬라이스 인덱스에 해당하는 오버레이 항목 필터링:
   filteredItems = overlayItems.filter(
     item => item.axis === currentAxis &&
             item.sliceIndex === currentSliceIndex &&
             item.visible
   )
4. 각 항목을 타입에 따라 렌더링:
   FOR each item IN filteredItems:
     SWITCH item.type:
       'distance-line': drawLine(item.points[0], item.points[1], item.style)
                        drawText(midpoint, item.label, item.style)
       'angle-line':    drawLine(item.points[0], item.points[1], item.style)
                        drawLine(item.points[1], item.points[2], item.style)
                        drawAngleArc(item.points, item.style)
                        drawText(vertexPos, item.label, item.style)
       'roi-rect':      drawRect(bounds, item.style)
       'roi-circle':    drawCircle(center, radius, item.style)
       'roi-free':      drawFreehand(item.points, item.style)
```

**화면 해상도 변경 시 오버레이 유지 알고리즘**:
```
1. 기존 오버레이 항목의 화면 좌표를 볼륨 좌표로 역변환:
   FOR each item IN overlayItems:
     item.volumePoints = item.points.map(p => screenToVolume(p))

2. 새 변환 행렬 설정:
   setTransform(newTransform)

3. 볼륨 좌표를 새 화면 좌표로 변환:
   FOR each item IN overlayItems:
     item.points = item.volumePoints.map(vp => volumeToScreen(vp))

4. 재렌더링:
   render()
```

#### 2.10.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| 캔버스 컨텍스트 획득 실패 | `OverlayInitError` 발생. 2D 캔버스 미지원 안내 |
| 좌표 변환 실패 | 해당 오버레이 항목 표시 건너뛰기. 경고 로그 |
| 오버레이 항목이 뷰포트 범위 밖 | 정상 렌더링 (잘림 허용) |
| 스타일 속성 누락 | 기본 스타일(DEFAULT_STYLES)로 폴백 |

---



### 2.11 MOD-011: 환자 데이터 매니저

**Jira 티켓**: PLAYG-2362
**관련 아키텍처**: ARCH-004 (Data Layer)
**관련 요구사항**: SW-REQ-008, SW-REQ-012

#### 2.11.1 클래스 설계

```
+----------------------------------+
|     PatientDataManager           |
+----------------------------------+
| - currentPatient: PatientSession |
| - previousPatient: PatientSession|
| - sessionCache: Map<string,      |
|   PatientSession>                |
| - isTransitioning: boolean       |
+----------------------------------+
| + loadPatient(dataset): void     |
| + getCurrentPatient():           |
|   PatientSession                 |
| + getPatientInfo(): PatientInfoUI|
| + clearCurrentPatient(): void    |
| + isPatientLoaded(): boolean     |
| + getStudyDate(): string         |
| + getModality(): string          |
| - createSession(dataset):        |
|   PatientSession                 |
| - destroySession(session): void  |
| - validateSessionIntegrity():    |
|   boolean                        |
+----------------------------------+
```

```
+----------------------------------+
|     PatientSession               |
+----------------------------------+
| + sessionId: string              |
| + patientInfo: PatientInfo       |
| + studyInfo: StudyInfo           |
| + seriesInfo: SeriesInfo         |
| + volumeData: VolumeData | null  |
| + createdAt: Date                |
| + isActive: boolean              |
+----------------------------------+
| + getDisplayInfo():              |
|   PatientInfoUI                  |
| + dispose(): void                |
+----------------------------------+
```

#### 2.11.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `loadPatient(dataset)` | DicomDataset | void | 새 환자 데이터 로드. 이전 세션 완전 교체(정보 혼합 방지). 전환 중 isTransitioning 플래그 설정 |
| `getCurrentPatient()` | 없음 | PatientSession | 현재 활성 환자 세션 반환. 로드된 환자가 없으면 null |
| `getPatientInfo()` | 없음 | PatientInfoUI | UI 표시용 환자 정보 반환. 캐싱 문제 방지를 위해 항상 새 객체 생성 |
| `clearCurrentPatient()` | 없음 | void | 현재 환자 세션 완전 삭제. 메모리 해제 포함 |
| `isPatientLoaded()` | 없음 | boolean | 현재 로드된 환자 세션 존재 여부 |
| `createSession(dataset)` | DicomDataset | PatientSession | DicomDataset으로부터 새 환자 세션 생성. 고유 sessionId 할당 |
| `destroySession(session)` | PatientSession | void | 세션 데이터 완전 삭제. VolumeData 메모리 해제. 가비지 컬렉션 유도 |
| `validateSessionIntegrity()` | 없음 | boolean | 현재 세션의 데이터 무결성 검증. 이전 환자 데이터 잔존 여부 확인 |

#### 2.11.3 데이터 구조

```typescript
interface PatientInfoUI {
  patientName: string;      // (0010,0010) 환자명
  patientId: string;        // (0010,0020) 환자 ID
  patientBirthDate: string; // (0010,0030) 생년월일 (포맷팅 적용)
  patientSex: string;       // (0010,0040) 성별 (Male/Female/Other 표시)
  studyDate: string;        // (0008,0020) 검사일자 (포맷팅 적용)
  modality: string;         // (0008,0060) 모달리티 (예: "CBCT")
  studyDescription: string; // (0008,1030) 검사 설명
  manufacturer: string;     // (0008,0070) 제조사
}

// 세션 관리용 내부 구조
interface SessionCache {
  maxCacheSize: number;     // 최대 캐시 세션 수 (기본값: 1)
  sessions: Map<string, PatientSession>;
}
```

#### 2.11.4 알고리즘

**환자 세션 전환 알고리즘 (정보 혼합 방지)**:
```
1. isTransitioning = true
2. UI에 "환자 데이터를 로드하고 있습니다..." 표시

3. 이전 환자 세션 완전 제거:
   IF currentPatient !== null:
     a. previousPatient = currentPatient
     b. currentPatient.volumeData.dispose()  // ArrayBuffer 해제
     c. currentPatient = null
     d. 세션 캐시 초기화
     e. UI 환자 정보 영역 초기화

4. 새 환자 세션 생성:
   a. newSession = createSession(dataset)
   b. sessionId = generateUUID()
   c. currentPatient = newSession

5. 세션 무결성 검증:
   a. currentPatient.patientInfo.patientId === dataset.patientInfo.patientId
   b. 이전 환자 데이터 잔존 여부 확인
   c. 실패 시: 세션 파기 후 오류 보고

6. UI 업데이트:
   a. 환자 정보 패널 갱신
   b. 뷰포트 초기화
   c. 측정 결과 초기화

7. isTransitioning = false
```

**환자 정보 포맷팅 알고리즘**:
```
1. 생년월일 포맷팅:
   rawDate = "19600101" (YYYYMMDD)
   → "1960-01-01"

2. 검사일자 포맷팅:
   rawDate = "20260101" (YYYYMMDD)
   → "2026-01-01"

3. 성별 표시:
   'M' → "Male", 'F' → "Female", 'O' → "Other", 기타 → 원본값

4. 환자명:
   DICOM PN(Person Name) 포맷 파싱: "LastName^FirstName"
   → "FirstName LastName" 형태로 변환
```

#### 2.11.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| 환자 세션 무결성 실패 | 세션 파기. 오류 메시지 표시 후 초기 상태로 복원 |
| 이전 환자 데이터 잔존 | 강제 메모리 해제. 세션 재생성 |
| 메모리 부족 | 이전 세션 즉시 해제 후 새 세션 생성 시도 |
| 필수 환자 정보 누락 | 누락된 필드를 "N/A"로 표시. 경고 로그 기록 |

---



### 2.12 MOD-012: 뷰포트 동기화 컨트롤러

**Jira 티켓**: PLAYG-2363
**관련 아키텍처**: ARCH-005 (Viewport Synchronization)
**관련 요구사항**: SW-REQ-009

#### 2.12.1 클래스 설계

```
+----------------------------------+
|     SyncController               |
+----------------------------------+
| - eventBus: EventBus             |
| - coordTransformer: CoordTrans   |
| - viewports: Map<string,         |
|   ViewportRef>                   |
| - isSyncing: boolean             |
| - syncDirection: 'bidirectional' |
| - lastSyncTimestamp: number      |
| - syncLatencyThreshold: number   |
+----------------------------------+
| + initialize(eventBus): void     |
| + registerViewport(id, vp): void |
| + unregisterViewport(id): void   |
| + syncFromMpr(axis, pos): void   |
| + syncFrom3D(position: Vector3): |
|   void                           |
| + enableSync(): void             |
| + disableSync(): void            |
| + isSyncEnabled(): boolean       |
| + getSyncLatency(): number       |
| + validateSync(): boolean        |
| - routeSyncEvent(source, data):  |
|   void                           |
| - resolveConflict(e1, e2):       |
|   SyncEvent                      |
+----------------------------------+
```

```
+----------------------------------+
|     EventBus                     |
+----------------------------------+
| - subscribers: Map<string,       |
|   Function[]>                    |
| - eventQueue: SyncEvent[]        |
| - isProcessing: boolean          |
+----------------------------------+
| + subscribe(event, callback): void|
| + unsubscribe(event, cb): void   |
| + publish(event, data): void     |
| - processQueue(): void           |
| + clear(): void                  |
+----------------------------------+
```

```
+----------------------------------+
|   CoordinateTransformer          |
+----------------------------------+
| - dicomToVolumeMatrix: Matrix4   |
| - volumeToDicomMatrix: Matrix4   |
| - imageOrientation: Vector3[]    |
| - imagePosition: Vector3         |
| - pixelSpacing: Vector2          |
+----------------------------------+
| + setDicomTransform(orient, pos, |
|   spacing): void                 |
| + mprToVolume(axis, screenPt):   |
|   Vector3                        |
| + volumeToMpr(axis, volPt):      |
|   ScreenPoint                    |
| + mprTo3D(axis, screenPt):       |
|   Vector3                        |
| + threeDToMpr(volPt):            |
|   Map<Axis, ScreenPoint>         |
| + validateTransform(): boolean   |
+----------------------------------+
```

#### 2.12.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `initialize(eventBus)` | EventBus 인스턴스 | void | 이벤트 버스 구독 설정. MPR 클릭, 3D 선택 이벤트 리스너 등록 |
| `registerViewport(id, vp)` | 뷰포트 ID, 뷰포트 참조 | void | 동기화 대상 뷰포트 등록 |
| `syncFromMpr(axis, pos)` | 축, 화면 위치 | void | MPR 클릭 → 3D 뷰 동기화. 좌표 변환 후 3D 뷰 위치 업데이트 |
| `syncFrom3D(position)` | 3D 공간 위치 | void | 3D 선택 → MPR 3단면 동기화. 좌표 변환 후 3개 축 모두 단면 위치 갱신 |
| `routeSyncEvent(source, data)` | 소스 ID, 이벤트 데이터 | void | 동기화 이벤트 라우팅. 충돌 발생 시 resolveConflict() 호출 |
| `resolveConflict(e1, e2)` | 두 동기화 이벤트 | SyncEvent | 동시 동기화 이벤트 충돌 해결. 최신 타임스탬프 이벤트 우선 |
| `validateSync()` | 없음 | boolean | 동기화 상태 검증. 좌표계 변환 일관성 확인 |
| `getSyncLatency()` | 없음 | number | 마지막 동기화 지연 시간(ms) 반환 |

#### 2.12.3 데이터 구조

```typescript
interface SyncEvent {
  source: 'mpr-axial' | 'mpr-coronal' | 'mpr-sagittal' | '3d';
  position: Vector3;       // 볼륨 공간 좌표
  screenPosition: ScreenPoint;
  timestamp: number;       // performance.now()
}

interface ViewportRef {
  id: string;
  type: 'mpr-axial' | 'mpr-coronal' | 'mpr-sagittal' | '3d';
  setPosition(pos: Vector3): void;
  getPosition(): Vector3;
}

// 동기화 설정 상수
const SYNC_CONSTANTS = {
  LATENCY_THRESHOLD_MS: 100,   // 동기화 지연 임계값
  DEBOUNCE_MS: 16,             // ~60fps 기준
  MAX_QUEUE_SIZE: 10,          // 최대 이벤트 큐 크기
};
```

#### 2.12.4 알고리즘

**MPR → 3D 동기화 알고리즘**:
```
1. MPR 클릭 이벤트 수신: { axis, screenPosition }
2. 화면 좌표 → 볼륨 좌표 변환:
   volumePos = coordTransformer.mprToVolume(axis, screenPosition)
3. 볼륨 좌표 → 3D 공간 좌표 변환:
   worldPos = coordTransformer.volumeToDicom(volumePos)
4. 이벤트 발행:
   eventBus.publish('sync:3d', { position: worldPos, source: 'mpr-' + axis })
5. 3D 뷰포트에서 위치 마커 업데이트
6. 동기화 지연 측정:
   latency = performance.now() - event.timestamp
   IF latency > 100ms:
     eventBus.publish('sync:warning', { latency })
```

**3D → MPR 동기화 알고리즘**:
```
1. 3D 뷰 클릭/선택 이벤트 수신: { position: worldPos }
2. 3D 공간 좌표 → 볼륨 좌표 변환:
   volumePos = coordTransformer.dicomToVolume(worldPos)
3. 볼륨 좌표 → 각 MPR 축 단면 인덱스 계산:
   axialIndex = Math.round(volumePos.z)
   coronalIndex = Math.round(volumePos.y)
   sagittalIndex = Math.round(volumePos.x)
4. 각 MPR 뷰포트에 단면 위치 설정:
   mprAxial.setPosition(volumePos)
   mprCoronal.setPosition(volumePos)
   mprSagittal.setPosition(volumePos)
5. 각 MPR 뷰포트 재렌더링 트리거
```

**동기화 충돌 해결 알고리즘**:
```
1. 두 동기화 이벤트가 거의 동시에 발생 (delta < 50ms):
2. 최신 타임스탬프 이벤트를 우선 채택:
   winner = e1.timestamp > e2.timestamp ? e1 : e2
3. 패배한 이벤트는 무시 (드랍)
4. 승리한 이벤트로 동기화 수행
```

#### 2.12.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| 좌표 변환 실패 | 동기화 중단. 사용자에게 "동기화 오류가 발생했습니다" 알림 |
| 동기화 지연 초과 (100ms) | 사용자에게 지연 경고 알림. 디버그 모드에서 지연 시간 표시 |
| 이벤트 큐 오버플로우 | 가장 오래된 이벤트부터 드랍. 최신 이벤트 우선 처리 |
| 변환 행렬 무효 | 동기화 비활성화. DICOM 메타데이터 재로드 권장 |
| 뷰포트 미등록 | 해당 뷰포트 동기화 건너뛰기. 경고 로그 기록 |

---



### 2.13 MOD-013: 보안 및 감사 모듈

**Jira 티켓**: PLAYG-2364
**관련 아키텍처**: ARCH-006 (Security Architecture)
**관련 요구사항**: SW-REQ-012, SW-REQ-013

#### 2.13.1 클래스 설계

```
+----------------------------------+
|     SecurityModule               |
+----------------------------------+
| - networkIsolation: NetworkIsol  |
| - cachePolicy: CachePolicy       |
| - accessControl: AccessControl   |
| - auditTrail: AuditTrail         |
| - isInitialized: boolean         |
+----------------------------------+
| + initialize(): void             |
| + validateSecurity(): SecurityRpt|
| + enforceCachePolicy(): void     |
| + getAuditLog(): AuditEntry[]    |
| + logAuditEvent(event): void     |
| + secureDispose(data): void      |
| + checkNetworkIsolation(): boolean|
+----------------------------------+
```

```
+----------------------------------+
|     NetworkIsolation             |
+----------------------------------+
| - blockedApis: string[]          |
| - isVerified: boolean            |
+----------------------------------+
| + verifyIsolation(): boolean     |
| + getBlockedApis(): string[]     |
| + monitorNetworkCalls(): void    |
+----------------------------------+

+----------------------------------+
|     CachePolicy                  |
+----------------------------------+
| - sensitiveKeys: string[]        |
| - policies: CachePolicyConfig    |
+----------------------------------+
| + enforceHeaders(): void         |
| + clearSensitiveCache(): void    |
| + preventCacheStorage(): void    |
| + getSessionCacheStatus():       |
|   CacheStatus                    |
+----------------------------------+

+----------------------------------+
|     AccessControl                |
+----------------------------------+
| - localAccessOnly: boolean       |
| - authorizedPaths: Set<string>   |
+----------------------------------+
| + validateLocalAccess(): boolean |
| + checkFileAccess(path): boolean |
| + preventUnauthorizedAccess():   |
|   void                           |
+----------------------------------+

+----------------------------------+
|     AuditTrail                   |
+----------------------------------+
| - entries: AuditEntry[]          |
| - maxSize: number                |
| - isLoggingEnabled: boolean      |
+----------------------------------+
| + log(entry: AuditEntry): void   |
| + getEntries(filter?):           |
|   AuditEntry[]                   |
| + exportLog(): string            |
| + clear(): void                  |
| + generateChecklist(): string    |
+----------------------------------+
```

#### 2.13.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `initialize()` | 없음 | void | 보안 모듈 초기화. 네트워크 격리 검증, 캐시 정책 적용, 접근 제어 설정 |
| `validateSecurity()` | 없음 | SecurityReport | 전체 보안 상태 검증. 네트워크 격리, 캐시 정책, 접근 제어 상태 종합 보고 |
| `enforceCachePolicy()` | 없음 | void | 브라우저 캐시에 환자 데이터 저장 방지 정책 적용 |
| `getAuditLog()` | 없음 | AuditEntry[] | 감사 로그 전체 조회 |
| `logAuditEvent(event)` | 감사 이벤트 | void | 감사 이벤트 기록. 형상 관리 연동 |
| `secureDispose(data)` | 민감 데이터 | void | 민감 데이터 안전 삭제. ArrayBuffer zero-fill 후 해제 |
| `checkNetworkIsolation()` | 없음 | boolean | 네트워크 통신 코드 부재 검증. fetch, XMLHttpRequest, WebSocket 등 확인 |
| `generateChecklist()` | 없음 | string | V&V 문서화 체크리스트 생성. IEC 62304 준수 항목 포함 |

#### 2.13.3 데이터 구조

```typescript
interface SecurityReport {
  networkIsolation: boolean;    // 네트워크 격리 상태
  cachePolicyEnforced: boolean; // 캐시 정책 적용 상태
  accessControlActive: boolean; // 접근 제어 활성 상태
  violations: SecurityViolation[];
  timestamp: Date;
}

interface SecurityViolation {
  type: 'network' | 'cache' | 'access';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  detectedAt: Date;
}

interface AuditEntry {
  id: string;
  eventType: 'data-load' | 'data-dispose' | 'config-change' | 'access' | 'security-check';
  description: string;
  userId: string;          // 로컬 사용자 식별자
  timestamp: Date;
  metadata: Map<string, string>;
}

interface CachePolicyConfig {
  preventLocalStorage: boolean;    // localStorage 사용 금지
  preventSessionStorage: boolean;  // sessionStorage 사용 금지
  preventIndexedDB: boolean;       // IndexedDB 사용 금지
  preventCacheAPI: boolean;        // Cache API 사용 금지
  clearOnUnload: boolean;          // 페이지 언로드 시 정리
}

// 차단할 네트워크 API 목록
const BLOCKED_NETWORK_APIS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'Beacon API (navigator.sendBeacon)',
];
```

#### 2.13.4 알고리즘

**네트워크 격리 검증 알고리즘**:
```
1. 소스 코드 정적 분석 (빌드 타임):
   FOR each sourceFile IN project:
     content = readFile(sourceFile)
     FOR each blockedApi IN BLOCKED_NETWORK_APIS:
       IF content.includes(blockedApi):
         reportViolation('network', 'critical',
           "${blockedApi} detected in ${sourceFile}")

2. 런타임 모니터링 (선택적):
   - window.fetch → 모니터링 래퍼 설정
   - XMLHttpRequest → 모니터링 래핑
   - 호출 감지 시 보안 경고 로그

3. 검증 결과 반환:
   IF violations.length === 0:
     return true (격리 확인)
   ELSE:
     return false (위반 감지)
```

**민감 데이터 안전 삭제 알고리즘**:
```
1. ArrayBuffer zero-fill:
   dataView = new Uint8Array(data)
   FOR i = 0 TO dataView.length:
     dataView[i] = 0

2. 참조 해제:
   data = null

3. 가비지 컬렉션 유도:
   (명시적 GC 불가하므로 참조 해제 후 자연스럽게 수행)

4. 감사 로그 기록:
   auditTrail.log({
     eventType: 'data-dispose',
     description: '환자 데이터 안전 삭제 완료',
     timestamp: Date.now()
   })
```

**캐시 정책 적용 알고리즘**:
```
1. HTTP 헤더 설정 (서비스 워커 또는 메타 태그):
   Cache-Control: no-store, no-cache, must-revalidate
   Pragma: no-cache

2. Storage API 오버라이드:
   localStorage.getItem → 민감 키 접근 시 null 반환
   sessionStorage.getItem → 민감 키 접근 시 null 반환

3. 페이지 언로드 시 정리:
   window.addEventListener('beforeunload', () => {
     clearSensitiveCache()
     secureDispose(currentPatientData)
   })
```

#### 2.13.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| 네트워크 API 감지 | `SecurityViolationError` 발생. 즉시 보고. 해당 코드 제거 필요 |
| 캐시 정책 위반 | 경고 로그 기록. 즉시 캐시 정리 |
| 민감 데이터 삭제 실패 | 재시도 (최대 3회). 실패 시 감사 로그에 기록 |
| 감사 로그 용량 초과 | 가장 오래된 항목부터 삭제 (FIFO) |
| 접근 권한 위반 | 접근 차단. 감사 로그에 위반 기록 |

---



### 2.14 MOD-014: 애플리케이션 셸 및 상태 관리

**Jira 티켓**: PLAYG-2365
**관련 아키텍처**: ARCH-007 (Frontend Application)
**관련 요구사항**: SW-REQ-010, SW-REQ-011

#### 2.14.1 클래스 설계

```
+----------------------------------+
|     ApplicationShell             |
+----------------------------------+
| - stateManager: StateManager     |
| - componentLayer: ComponentLayer |
| - modules: Map<string, Module>   |
| - isInitialized: boolean         |
| - browserInfo: BrowserInfo       |
| - lifecycleState: LifecycleState |
+----------------------------------+
| + initialize(): void             |
| + start(): void                  |
| + shutdown(): void               |
| + getState(): AppState           |
| + dispatch(action: Action): void |
| + subscribe(selector, cb): void  |
| + registerModule(module): void   |
| + getModule(id: string): Module  |
| - checkBrowserCompat(): boolean  |
| - setupLifecycle(): void         |
| - handleBeforeUnload(): void     |
+----------------------------------+
```

```
+----------------------------------+
|     StateManager                 |
+----------------------------------+
| - state: AppState                |
| - subscribers: Map<string,       |
|   Subscriber[]>                  |
| - middleware: Middleware[]        |
| - history: AppState[]            |
+----------------------------------+
| + getState(): AppState           |
| + dispatch(action: Action): void |
| + subscribe(selector, cb): void  |
| + unsubscribe(id: string): void  |
| + applyMiddleware(mw): void      |
| - reduce(state, action):         |
|   AppState                       |
| - notifySubscribers(): void      |
| + getStateSnapshot(): AppState   |
+----------------------------------+
```

```
+----------------------------------+
|     ComponentLayer               |
+----------------------------------+
| - viewportComponent: ViewportCmp |
| - toolPanel: ToolPanel           |
| - infoPanel: InfoPanel           |
| - layoutManager: LayoutManager   |
+----------------------------------+
| + render(): void                 |
| + updateLayout(layout): void     |
| + getActiveComponent(): Component|
| + focusComponent(id): void       |
+----------------------------------+
```

#### 2.14.2 메서드/함수 설계

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `initialize()` | 없음 | void | 애플리케이션 초기화. 브라우저 호환성 검증 → 모듈 등록 → 상태 관리 초기화 → 컴포넌트 레이어 생성 → 이벤트 바인딩 |
| `start()` | 없음 | void | 애플리케이션 시작. 초기 UI 렌더링 → 렌더 루프 시작 |
| `shutdown()` | 없음 | void | 애플리케이션 종료. 렌더 루프 중지 → 모든 모듈 dispose → 환자 데이터 안전 삭제 |
| `getState()` | 없음 | AppState | 현재 애플리케이션 상태 스냅샷 반환 |
| `dispatch(action)` | 상태 변경 액션 | void | 상태 변경 액션 발행. 미들웨어 처리 → 상태 업데이트 → 구독자 통지 |
| `subscribe(selector, cb)` | 상태 선택자, 콜백 | string | 상태 변경 구독. 선택자로 특정 상태 변경만 감지. 구독 ID 반환 |
| `registerModule(module)` | 모듈 인스턴스 | void | 외부 모듈(DICOM 파서, 렌더러 등)을 애플리케이션에 등록 |
| `checkBrowserCompat()` | 없음 | boolean | 브라우저 호환성 검증. Chrome/Edge 확인, WebGL 2.0 지원 확인 |

#### 2.14.3 데이터 구조

```typescript
interface AppState {
  // 볼륨 데이터 상태
  volume: {
    isLoaded: boolean;
    dimensions: Vector3 | null;
    dataType: 'int16' | 'uint16' | null;
  };

  // 환자 세션 상태
  patient: {
    isLoaded: boolean;
    info: PatientInfoUI | null;
  };

  // 뷰포트 상태
  viewports: {
    axial: ViewportState;
    coronal: ViewportState;
    sagittal: ViewportState;
    volume3d: ViewportState;
  };

  // 활성 도구 상태
  activeTool: 'none' | 'distance' | 'angle' | 'roi-rect' | 'roi-circle' | 'roi-free';

  // WL/WW 상태
  windowing: {
    center: number;
    width: number;
    isDefault: boolean;
  };

  // 카메라 상태
  camera: CameraState;

  // 동기화 상태
  sync: {
    isEnabled: boolean;
    lastSyncTime: number;
  };

  // 애플리케이션 UI 상태
  ui: {
    isLoading: boolean;
    loadingMessage: string;
    activeError: AppError | null;
    layout: LayoutConfig;
  };
}

interface ViewportState {
  slicePosition: number;  // 0.0 ~ 1.0
  width: number;
  height: number;
  isHovered: boolean;
}

interface Action {
  type: string;
  payload?: any;
  timestamp: number;
}

// 액션 타입 정의
type ActionType =
  | 'VOLUME_LOADED'
  | 'VOLUME_UNLOADED'
  | 'PATIENT_LOADED'
  | 'PATIENT_CLEARED'
  | 'SLICE_POSITION_CHANGED'
  | 'WINDOWING_CHANGED'
  | 'TOOL_ACTIVATED'
  | 'MEASUREMENT_ADDED'
  | 'MEASUREMENT_REMOVED'
  | 'CAMERA_UPDATED'
  | 'SYNC_ENABLED'
  | 'SYNC_DISABLED'
  | 'ERROR_OCCURRED'
  | 'ERROR_DISMISSED'
  | 'LAYOUT_CHANGED';

interface BrowserInfo {
  name: 'Chrome' | 'Edge' | 'Firefox' | 'Safari' | 'Unknown';
  version: string;
  isWebGL2Supported: boolean;
  isCompatible: boolean;
}
```

#### 2.14.4 알고리즘

**애플리케이션 초기화 알고리즘**:
```
1. 브라우저 호환성 검증:
   browserInfo = detectBrowser()
   IF !browserInfo.isCompatible:
     displayUnsupportedBrowserMessage()
     return

   IF !browserInfo.isWebGL2Supported:
     displayWebGL2Warning()
     return

2. 상태 관리 초기화:
   stateManager = new StateManager(initialState)
   applyMiddleware(loggingMiddleware)
   applyMiddleware(performanceMiddleware)

3. 모듈 등록:
   registerModule(new DicomParser())
   registerModule(new VolumeBuilder())
   registerModule(new WebGLContextManager())
   registerModule(new MprRenderer())
   registerModule(new VolumeRenderer())
   registerModule(new CameraModel())
   registerModule(new InputHandler())
   registerModule(new MeasurementEngine())
   registerModule(new OverlayRenderer())
   registerModule(new PatientDataManager())
   registerModule(new SyncController())
   registerModule(new SecurityModule())

4. 컴포넌트 레이어 생성:
   componentLayer = new ComponentLayer()
   componentLayer.createViewportComponents()
   componentLayer.createToolPanel()
   componentLayer.createInfoPanel()

5. 이벤트 바인딩:
   bindModuleEvents()
   bindUIEvents()
   bindKeyboardShortcuts()

6. 보안 모듈 초기화:
   securityModule.initialize()
   securityModule.enforceCachePolicy()

7. 렌더 루프 시작:
   startRenderLoop()
```

**상태 관리 (Redux 패턴) 알고리즘**:
```
1. dispatch(action) 호출:
   a. 미들웨어 체인 실행:
      FOR each middleware IN middlewareChain:
        action = middleware(action, state)
        IF action === null: return  // 액션 취소

   b. 상태 업데이트:
      newState = reduce(state, action)
      history.push(state)  // 이전 상태 히스토리 저장
      state = newState

   c. 구독자 통지:
      FOR each subscriber IN subscribers:
        selectedValue = subscriber.selector(state)
        IF selectedValue !== subscriber.prevValue:
          subscriber.callback(selectedValue)
          subscriber.prevValue = selectedValue
```

**반응형 레이아웃 알고리즘**:
```
1. 화면 크기 감지:
   window.addEventListener('resize', debounce(handleResize, 100))

2. handleResize():
   containerWidth = window.innerWidth
   containerHeight = window.innerHeight

   IF containerWidth >= 1200:
     layout = 'quad'       // 2x2 그리드 (MPR 3 + 3D)
   ELSE IF containerWidth >= 768:
     layout = 'triple'     // MPR 3 스택 + 3D
   ELSE:
     layout = 'single'     // 단일 뷰포트 + 탭 전환

   dispatch({ type: 'LAYOUT_CHANGED', payload: layout })

3. 각 뷰포트 크기 재계산:
   FOR each viewport IN viewports:
     viewport.resize(newWidth, newHeight)
```

#### 2.14.5 에러 처리

| 에러 조건 | 처리 방법 |
|-----------|----------|
| 비지원 브라우저 | "Chrome 또는 Edge 최신 버전을 사용해주세요" 안내 페이지 표시. 애플리케이션 초기화 중단 |
| WebGL 2.0 미지원 | "WebGL 2.0이 지원되지 않는 환경입니다" 경고. GPU 드라이버 업데이트 권장 |
| 모듈 초기화 실패 | 해당 모듈 비활성화 후 계속 진행. 관련 기능 비활성화 안내 |
| 상태 불일치 | 이전 상태 스냅샷으로 롤백. 오류 로그 기록 |
| 메모리 부족 | 렌더링 품질 저하. 불필요한 캐시 정리. 사용자에게 안내 |
| 렌더 루프 예외 | 렌더 루프 중지 → 예외 로깅 → 사용자 알림 → 재시작 옵션 제공 |

---


## 3. 인터페이스 상세

### 3.1 DICOM 파일 입력 인터페이스

**소스**: 사용자 로컬 파일 시스템
**대상**: MOD-001 (DICOM 파일 파서)
**관련 요구사항**: SW-REQ-001

```typescript
interface DicomFileInput {
  // 브라우저 File API를 통한 파일 입력
  files: FileList;                   // 사용자가 선택한 DICOM 파일 목록
  onFileSelected: (files: FileList) => void;
  onFileLoadProgress: (progress: number) => void;
  onFileLoadError: (error: FileReadError) => void;
}

interface FileReadError {
  code: 'READ_DENIED' | 'FILE_TOO_LARGE' | 'READ_FAILED';
  message: string;
  fileName: string;
}
```

| 항목 | 상세 |
|------|------|
| 입력 방식 | HTML `<input type="file">` 또는 Drag & Drop |
| 파일 형식 | DICOM Part 10 (.dcm) |
| 최대 파일 크기 | 512MB (512³ × 2bytes 기준) |
| 다중 파일 | 슬라이스 시퀀스 로드 지원 |

---

### 3.2 DICOM 파서 → 볼륨 빌더 인터페이스

**소스**: MOD-001 (DICOM 파일 파서)
**대상**: MOD-003 (볼륨 데이터 빌더)
**데이터**: DicomDataset[]

```typescript
interface ParserToBuilder {
  // 파싱된 DICOM 데이터셋 배열 전달
  transfer(datasets: DicomDataset[]): void;
  onTransferComplete: (volume: VolumeData) => void;
  onTransferError: (error: VolumeBuildError) => void;
}
```

| 항목 | 상세 |
|------|------|
| 전달 데이터 | DicomDataset 배열 (정렬 전) |
| 전달 방식 | 직접 함수 호출 |
| 에러 전파 | VolumeBuildError 예외 |

---

### 3.3 볼륨 빌더 → 렌더링 컨텍스트 인터페이스

**소스**: MOD-003 (볼륨 데이터 빌더)
**대상**: MOD-004 (WebGL 렌더링 컨텍스트 관리자)
**데이터**: VolumeData

```typescript
interface BuilderToRenderer {
  // 볼륨 데이터를 WebGL 3D 텍스처로 업로드
  uploadVolume(volumeData: VolumeData): WebGLTexture;
  onUpdateProgress: (progress: number) => void;
  onUploadComplete: () => void;
  onUploadError: (error: GPUUploadError) => void;
}
```

| 항목 | 상세 |
|------|------|
| 전달 데이터 | VolumeData (ArrayBuffer + 메타데이터) |
| 전달 방식 | WebGL texImage3D 호출 |
| 데이터 크기 | 최대 512³ × 2 bytes = 256MB |

---

### 3.4 렌더링 컨텍스트 → MPR 렌더러 인터페이스

**소스**: MOD-004 (WebGL 렌더링 컨텍스트 관리자)
**대상**: MOD-005 (MPR 렌더러)
**데이터**: WebGLTexture, WebGLProgram

```typescript
interface ContextToMprRenderer {
  volumeTexture: WebGLTexture;
  mprShaderProgram: WebGLProgram;
  getUniforms(): MprUniforms;
}
```

---

### 3.5 렌더링 컨텍스트 → 3D 볼륨 렌더러 인터페이스

**소스**: MOD-004 (WebGL 렌더링 컨텍스트 관리자)
**대상**: MOD-006 (3D 볼륨 렌더러)
**데이터**: WebGLTexture, WebGLProgram

```typescript
interface ContextToVolumeRenderer {
  volumeTexture: WebGLTexture;
  rayCastingShaderProgram: WebGLProgram;
  getUniforms(): RayCastingUniforms;
}
```

---

### 3.6 카메라 시스템 → 렌더러 인터페이스

**소스**: MOD-007 (카메라 시스템)
**대상**: MOD-006 (3D 볼륨 렌더러)
**데이터**: View Matrix, Projection Matrix

```typescript
interface CameraToRenderer {
  viewMatrix: Matrix4;        // 4×4 뷰 행렬 (Float32Array)
  projectionMatrix: Matrix4;  // 4×4 투영 행렬 (Float32Array)
  cameraPosition: Vector3;    // 월드 공간 카메라 위치
}
```

| 항목 | 상세 |
|------|------|
| 갱신 주기 | 프레임마다 (requestAnimationFrame) |
| 데이터 형식 | Float32Array (16 요소) |

---

### 3.7 입력 핸들러 → 카메라/도구 엔진 인터페이스

**소스**: MOD-008 (입력 핸들러)
**대상**: MOD-007 (카메라 시스템), MOD-009 (측정 도구 엔진)
**데이터**: 입력 이벤트 데이터

```typescript
interface InputToCamera {
  onRotate: (data: RotateEventData) => void;
  onZoom: (data: ZoomEventData) => void;
  onPan: (data: PanEventData) => void;
}

interface InputToTools {
  onClick: (data: ClickEventData) => void;
}
```

---

### 3.8 측정 도구 → 오버레이 렌더러 인터페이스

**소스**: MOD-009 (측정 도구 엔진)
**대상**: MOD-010 (오버레이 렌더러)
**데이터**: Measurement 객체

```typescript
interface ToolsToOverlay {
  measurements: Measurement[];
  onMeasurementAdded: (m: Measurement) => void;
  onMeasurementRemoved: (id: string) => void;
  onMeasurementUpdated: (m: Measurement) => void;
}
```

---

### 3.9 뷰포트 동기화 인터페이스

**소스**: MOD-012 (뷰포트 동기화 컨트롤러)
**대상**: MOD-005 (MPR 렌더러), MOD-006 (3D 볼륨 렌더러)
**데이터**: 동기화 이벤트

```typescript
interface SyncInterface {
  // MPR → 3D 동기화
  onMprPositionChanged: (axis: Axis, position: Vector3) => void;

  // 3D → MPR 동기화
  on3DPositionSelected: (position: Vector3) => void;

  // 동기화 오류
  onSyncError: (error: SyncError) => void;
}

interface SyncError {
  code: 'TRANSFORM_FAILED' | 'LATENCY_EXCEEDED' | 'VIEWPORT_NOT_FOUND';
  message: string;
  sourceAxis?: Axis;
}
```

| 항목 | 상세 |
|------|------|
| 동기화 방향 | 양방향 (MPR ↔ 3D) |
| 지연 목표 | 100ms 이내 |
| 이벤트 버스 | Pub/Sub 패턴 |

---

### 3.10 상태 관리 인터페이스

**소스**: MOD-014 (애플리케이션 셸)
**대상**: 모든 모듈
**데이터**: AppState, Action

```typescript
interface StateManagement {
  getState(): AppState;
  dispatch(action: Action): void;
  subscribe(selector: (state: AppState) => T, callback: (value: T) => void): string;
}
```

| 항목 | 상세 |
|------|------|
| 상태 관리 | 중앙 집중식 (Redux 패턴) |
| 통지 방식 | 구독자 기반 선택적 통지 |
| 상태 불변성 | immer 기반 불변 업데이트 |

---


## 4. 단위 테스트 계획

### 4.1 MOD-001 DICOM 파일 파서 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-001-01 | 유효한 DICOM 파일 파싱 | 표준 DICOM 테스트 파일 로드 | DicomDataset 정상 반환. 필수 태그 모두 추출 | SW-REQ-001-01 |
| UT-001-02 | 매직 바이트 불일치 | DICM 마커가 없는 파일 | InvalidDicomError 발생 | SW-REQ-001-01 |
| UT-001-03 | 필수 태그 누락 | Patient ID 누락 파일 | MissingRequiredTagError 발생 | SW-REQ-001-02 |
| UT-001-04 | 전송 구문 검증 | 미지원 전송 구문 파일 | UnsupportedTransferSyntaxError 발생 | SW-REQ-001-03 |
| UT-001-05 | 손상된 파일 처리 | 픽셀 데이터 없는 파일 | 오류 메시지 표시 후 로드 중단 | SW-REQ-001-04 |
| UT-001-06 | 픽셀 데이터 무결성 | 예상 크기와 다른 픽셀 데이터 | PixelDataCorruptionError 발생 | SW-REQ-001-05 |
| UT-001-07 | 다양한 문자 인코딩 | ISO-2022-JP, UTF-8, ASCII 파일 | 각 인코딩에 맞는 환자명 디코딩 | SW-REQ-008-04 |

### 4.2 MOD-002 전송 구문 및 문자 인코딩 처리기 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-002-01 | Implicit VR Little Endian | 해당 전송 구문 파일 파싱 | 정상 파싱, isExplicitVR=false | SW-REQ-001-03 |
| UT-002-02 | Explicit VR Little Endian | 해당 전송 구문 파일 파싱 | 정상 파싱, isExplicitVR=true | SW-REQ-001-03 |
| UT-002-03 | JPEG Lossless 압축 해제 | 압축 전송 구문 픽셀 데이터 | 올바른 ArrayBuffer 디코딩 | SW-REQ-001-03 |
| UT-002-04 | 문자 인코딩 감지 | 각 Character Set 태그값 | 올바른 TextDecoder 반환 | SW-REQ-008-04 |
| UT-002-05 | 알 수 없는 문자 인코딩 | 미지원 charset 값 | ASCII 폴백, 경고 로그 | SW-REQ-008-04 |

### 4.3 MOD-003 볼륨 데이터 빌더 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-003-01 | 다중 슬라이스 볼륨 구성 | 100개 슬라이스 입력 | 512x512x100 VolumeData 생성 | SW-REQ-001 |
| UT-003-02 | 슬라이스 정렬 | 순서 섞인 슬라이스 입력 | Z축 기준 올바른 정렬 | SW-REQ-002-02 |
| UT-003-03 | 체적 픽셀 크기 계산 | Pixel Spacing 0.3, Thickness 0.3 | voxelSize = (0.3, 0.3, 0.3) | SW-REQ-006-01 |
| UT-003-04 | 무결성 검증 | 불완전한 슬라이스 포함 | VolumeIntegrityError 발생 | SW-REQ-001-05 |
| UT-003-05 | 점진적 로딩 | 대용량 볼륨 로드 | 진행률 콜백 호출, 최종 완전 데이터 | SW-REQ-010-05 |

### 4.4 MOD-004 WebGL 렌더링 컨텍스트 관리자 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-004-01 | WebGL 2.0 컨텍스트 생성 | 캔버스 요소 전달 | 정상 컨텍스트 획득 | SW-REQ-011-03 |
| UT-004-02 | 3D 텍스처 생성 | 512x512x512 볼륨 데이터 | WebGLTexture 생성, LINEAR 필터링 | SW-REQ-003 |
| UT-004-03 | 셰이더 컴파일 | 유효한 GLSL 소스 | WebGLProgram 생성 | SW-REQ-002 |
| UT-004-04 | 잘못된 셰이더 소스 | 문법 오류 GLSL | ShaderCompileError 발생 | SW-REQ-002 |
| UT-004-05 | 컨텍스트 손실/복원 | 컨텍스트 손실 시뮬레이션 | 리소스 재생성 후 정상 렌더링 | SW-REQ-011 |

### 4.5 MOD-005 MPR 렌더러 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-005-01 | 3단면 렌더링 | 512x512x512 볼륨 데이터 | Axial/Coronal/Sagittal 정상 렌더링 | SW-REQ-002-01 |
| UT-005-02 | 단면 위치 이동 | position 0.0~1.0 변경 | 각 위치에서 정확한 단면 갱신 | SW-REQ-002-04 |
| UT-005-03 | WL/WW 선형 매핑 | WL=500, WW=2000 설정 | 픽셀-휘도 선형 매핑 검증 | SW-REQ-005-01 |
| UT-005-04 | WL/WW 리셋 | 변경 후 리셋 | 원래 기본값으로 복원 | SW-REQ-005-05 |
| UT-005-05 | 보간 모드 전환 | LINEAR/NEAREST 전환 | LINEAR에서 왜곡 없음 | SW-REQ-002-03 |
| UT-005-06 | 렌더링 성능 | 512x512x512, fps 측정 | 30fps 이상 달성 | SW-REQ-010-01 |

### 4.6 MOD-006 3D 볼륨 렌더러 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-006-01 | 기본 3D 렌더링 | CBCT 볼륨 Ray Casting | 해부학적 구조 시각화 | SW-REQ-003-01 |
| UT-006-02 | 전송 함수 변경 | 불투명도/색상 수정 | 즉시 렌더링 갱신 | SW-REQ-003-02 |
| UT-006-03 | CBCT 기본 프리셋 | 기본 전송 함수 적용 | 치아/골조직/연조직/공기 구분 | SW-REQ-003-01 |
| UT-006-04 | Early Ray Termination | 고불투명도 볼륨 | 알파 0.95 시 레이 종료 | SW-REQ-003-04 |
| UT-006-05 | 렌더링 성능 | 512x512x512, fps 측정 | 15fps 이상 달성 | SW-REQ-010-02 |

### 4.7 MOD-007 카메라 시스템 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-007-01 | 궤도 회전 | deltaX=100, deltaY=50 | 자연스러운 카메라 회전 | SW-REQ-004-01 |
| UT-007-02 | 줌 범위 제한 | delta +/-500 | MIN~MAX 범위 내 거리 변화 | SW-REQ-004-02 |
| UT-007-03 | 쿼터니언 정규화 | 1000회 연속 회전 | NaN 없음, 단위 쿼터니언 유지 | SW-REQ-004-03 |
| UT-007-04 | 뷰 리셋 | 회전/줌 후 리셋 | 초기 상태로 정확 복원 | SW-REQ-004-05 |
| UT-007-05 | 터치 입력 동등성 | 핀치/팬 이벤트 | 마우스와 동일 동작 | SW-REQ-004-04 |

### 4.8 MOD-008 입력 핸들러 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-008-01 | 마우스 드래그 - 회전 | 좌클릭 드래그 | rotate 이벤트 emit | SW-REQ-004-01 |
| UT-008-02 | Shift+드래그 - 팬 | Shift+좌클릭 드래그 | pan 이벤트 emit | SW-REQ-004 |
| UT-008-03 | 스크롤 - 줌 | 마우스 휠 | zoom 이벤트 emit | SW-REQ-004-02 |
| UT-008-04 | 터치 핀치 - 줌 | 2점 터치 핀치 | zoom 이벤트 emit | SW-REQ-004-04 |
| UT-008-05 | 입력 비활성화 | disable() 후 입력 | 이벤트 미발생 | SW-REQ-004 |

### 4.9 MOD-009 측정 도구 엔진 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-009-01 | 거리 측정 (Pixel Spacing) | spacing=(0.3,0.3), 두 점 | mm 단위 정확한 거리값 | SW-REQ-006-01 |
| UT-009-02 | 거리 측정 (Spacing 없음) | spacing=null, 두 점 | px 단위 + 경고 표시 | SW-REQ-006-02 |
| UT-009-03 | 각도 측정 (직각) | 세 점 (직각 구성) | 90.00도 반환 | SW-REQ-006-03 |
| UT-009-04 | 소수점 정밀도 | 임의 두 점 | 소수점 둘째 자리까지 | SW-REQ-006-05 |
| UT-009-05 | 단위 변환 정확성 | mm, degree 결과 | 올바른 단위 표시 | SW-REQ-006-06 |



### 4.10 MOD-010 오버레이 렌더러 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-010-01 | 측정선 렌더링 | 거리 측정 결과 | 선분 + 수치 정상 표시 | SW-REQ-006-04 |
| UT-010-02 | ROI 사각형 표시 | 사각형 ROI 생성 | 사각형 + 반투명 채움 | SW-REQ-007-01 |
| UT-010-03 | 해상도 변경 시 유지 | 캔버스 리사이즈 | ROI 위치/크기 정상 유지 | SW-REQ-007-02 |
| UT-010-04 | 단면 이동 시 필터링 | 다른 슬라이스 인덱스 | 해당 단면 오버레이만 표시 | SW-REQ-007-03 |
| UT-010-05 | ROI 생성/수정/삭제 | ROI CRUD 작업 | 각 작업 정상 동작 | SW-REQ-007-04 |

### 4.11 MOD-011 환자 데이터 매니저 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-011-01 | 환자 정보 표시 | DICOM 파일 로드 | 필수 환자 정보 정확 표시 | SW-REQ-008-01 |
| UT-011-02 | 환자 전환 시 정보 혼합 방지 | 두 환자 연속 로드 | 두 번째 환자 정보만 표시 | SW-REQ-008-03 |
| UT-011-03 | 캐싱 문제 없음 | 동일 환자 재로드 | 새 세션 생성, 이전 캐시 무효 | SW-REQ-008-02 |
| UT-011-04 | 문자 인코딩 호환성 | 다양한 인코딩 파일 | 올바른 환자명 표시 | SW-REQ-008-04 |

### 4.12 MOD-012 뷰포트 동기화 컨트롤러 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-012-01 | MPR-3D 동기화 | MPR 단면 클릭 | 3D 뷰에 해당 위치 반영 | SW-REQ-009-01 |
| UT-012-02 | 3D-MPR 동기화 | 3D 뷰 위치 선택 | MPR 3단면 위치 반영 | SW-REQ-009-02 |
| UT-012-03 | 좌표계 변환 일관성 | 순/역방향 변환 | 원래 좌표로 복원 (오차 < 0.01) | SW-REQ-009-03 |
| UT-012-04 | 동기화 지연 측정 | 100회 동기화 수행 | 평균 지연 100ms 이내 | SW-REQ-009-05 |
| UT-012-05 | 동기화 오류 알림 | 변환 실패 시뮬레이션 | 사용자 알림 표시 | SW-REQ-009-04 |

### 4.13 MOD-013 보안 및 감사 모듈 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-013-01 | 네트워크 코드 부재 검증 | 소스 코드 정적 분석 | fetch/XMLHttpRequest/WebSocket 미발견 | SW-REQ-012-01 |
| UT-013-02 | 캐시 정책 적용 | localStorage 접근 시도 | 민감 데이터 null 반환 | SW-REQ-012-02 |
| UT-013-03 | 민감 데이터 안전 삭제 | secureDispose() 호출 | ArrayBuffer zero-fill 확인 | SW-REQ-012-03 |
| UT-013-04 | 로컬 전용 검증 | 코드 리뷰 자동화 | 외부 통신 코드 미존재 | SW-REQ-012-04 |
| UT-013-05 | 감사 로그 기록 | 데이터 로드/삭제 수행 | 감사 엔트리 정상 생성 | SW-REQ-013-01 |

### 4.14 MOD-014 애플리케이션 셸 및 상태 관리 테스트

| 테스트 ID | 테스트 항목 | 테스트 방법 | 예상 결과 | 관련 요구사항 |
|-----------|------------|------------|----------|--------------|
| UT-014-01 | 브라우저 호환성 검증 | Chrome/Edge 환경 | 정상 초기화, 호환 가능 | SW-REQ-011-01 |
| UT-014-02 | 비지원 브라우저 감지 | Firefox/Safari 환경 | 안내 메시지 표시 | SW-REQ-011-02 |
| UT-014-03 | WebGL 2.0 미지원 감지 | WebGL 2.0 없는 환경 | 경고 메시지 표시 | SW-REQ-011-03 |
| UT-014-04 | 반응형 레이아웃 | 화면 크기 변경 | 레이아웃 자동 조정 | SW-REQ-011-04 |
| UT-014-05 | 상태 관리 일관성 | 다중 액션 동시 발행 | 상태 일관성 유지 | SW-REQ-010 |
| UT-014-06 | 초기 로딩 시간 | 512x512x512 볼륨 로드 | 5초 이내 완료 | SW-REQ-010-03 |
| UT-014-07 | 종료 시 안전 정리 | shutdown() 호출 | 모든 데이터 안전 삭제 | SW-REQ-012 |

---


## 5. 요구사항 추적성

### 5.1 SRS 요구사항 -> 모듈 -> 단위 테스트 추적성

| SWS ID | 요구사항 명칭 | 모듈 | 단위 테스트 |
|--------|--------------|------|------------|
| SW-REQ-001 | DICOM 파일 로드 및 파싱 | MOD-001, MOD-002, MOD-003 | UT-001-01~07, UT-002-01~05, UT-003-01~05 |
| SW-REQ-002 | MPR 3단면 실시간 렌더링 | MOD-004, MOD-005 | UT-004-01~05, UT-005-01~06 |
| SW-REQ-003 | 3D 볼륨 렌더링 (Ray Casting) | MOD-004, MOD-006 | UT-004-02, UT-006-01~05 |
| SW-REQ-004 | 3D 회전/확대/축소 제어 | MOD-007, MOD-008 | UT-007-01~05, UT-008-01~05 |
| SW-REQ-005 | Window Level/Width 조절 | MOD-005 | UT-005-03, UT-005-04 |
| SW-REQ-006 | 거리 및 각도 측정 도구 | MOD-009, MOD-010 | UT-009-01~05, UT-010-01 |
| SW-REQ-007 | ROI(관심영역) 표시 | MOD-009, MOD-010 | UT-010-01~05 |
| SW-REQ-008 | 환자 정보 표시 | MOD-011 | UT-011-01~04 |
| SW-REQ-009 | MPR-3D 뷰 동기화 | MOD-012 | UT-012-01~05 |
| SW-REQ-010 | 렌더링 성능 요구사항 | MOD-003, MOD-005, MOD-006, MOD-014 | UT-003-05, UT-005-06, UT-006-05, UT-014-05~06 |
| SW-REQ-011 | 사용자 인터페이스 요구사항 | MOD-014 | UT-014-01~04 |
| SW-REQ-012 | 환자 데이터 보안 요구사항 | MOD-013 | UT-013-01~04 |
| SW-REQ-013 | 의료기기 소프트웨어 규제 요구사항 | MOD-013 | UT-013-05 |

### 5.2 아키텍처 컴포넌트 -> 모듈 추적성

| ARCH 컴포넌트 | ARCH 티켓 | 세부 모듈 | 모듈 티켓 |
|---------------|-----------|-----------|-----------|
| ARCH-001: Rendering Pipeline | PLAYG-2299 | MOD-001 DICOM 파일 파서 | PLAYG-2352 |
| | | MOD-002 전송 구문 및 문자 인코딩 처리기 | PLAYG-2353 |
| | | MOD-003 볼륨 데이터 빌더 | PLAYG-2354 |
| | | MOD-004 WebGL 렌더링 컨텍스트 관리자 | PLAYG-2355 |
| | | MOD-005 MPR 렌더러 | PLAYG-2356 |
| | | MOD-006 3D 볼륨 렌더러 | PLAYG-2357 |
| ARCH-002: Camera & Interaction | PLAYG-2300 | MOD-007 카메라 시스템 | PLAYG-2358 |
| | | MOD-008 입력 핸들러 | PLAYG-2359 |
| ARCH-003: Analysis Tools | PLAYG-2301 | MOD-009 측정 도구 엔진 | PLAYG-2360 |
| | | MOD-010 오버레이 렌더러 | PLAYG-2361 |
| ARCH-004: Data Layer | PLAYG-2302 | MOD-011 환자 데이터 매니저 | PLAYG-2362 |
| ARCH-005: Viewport Synchronization | PLAYG-2303 | MOD-012 뷰포트 동기화 컨트롤러 | PLAYG-2363 |
| ARCH-006: Security Architecture | PLAYG-2304 | MOD-013 보안 및 감사 모듈 | PLAYG-2364 |
| ARCH-007: Frontend Application | PLAYG-2305 | MOD-014 애플리케이션 셸 및 상태 관리 | PLAYG-2365 |

### 5.3 전체 추적성 요약 (SyRS -> SRS -> SAD -> SDS)

| System ID | SWS ID | 아키텍처 | 모듈 | 테스트 |
|-----------|--------|----------|------|--------|
| SR-001 | SW-REQ-001 | ARCH-001, ARCH-004 | MOD-001, MOD-002, MOD-003 | UT-001, UT-002, UT-003 |
| SR-002 | SW-REQ-002 | ARCH-001 | MOD-004, MOD-005 | UT-004, UT-005 |
| SR-003 | SW-REQ-003 | ARCH-001 | MOD-004, MOD-006 | UT-004, UT-006 |
| SR-004 | SW-REQ-004 | ARCH-002 | MOD-007, MOD-008 | UT-007, UT-008 |
| SR-005 | SW-REQ-005 | ARCH-002 | MOD-005 | UT-005 |
| SR-006 | SW-REQ-006 | ARCH-003 | MOD-009, MOD-010 | UT-009, UT-010 |
| SR-007 | SW-REQ-007 | ARCH-003 | MOD-009, MOD-010 | UT-010 |
| SR-008 | SW-REQ-008 | ARCH-004 | MOD-011 | UT-011 |
| SR-009 | SW-REQ-009 | ARCH-005 | MOD-012 | UT-012 |
| SR-010 | SW-REQ-010 | ARCH-001, ARCH-007 | MOD-003, MOD-005, MOD-006, MOD-014 | UT-003, UT-005, UT-006, UT-014 |
| SR-011 | SW-REQ-011 | ARCH-007 | MOD-014 | UT-014 |
| SR-012 | SW-REQ-012 | ARCH-006 | MOD-013 | UT-013 |
| SR-013 | SW-REQ-013 | ARCH-006 | MOD-013 | UT-013 |

### 5.4 모듈별 단위 테스트 개수 요약

| 모듈 | 테스트 개수 |
|------|------------|
| MOD-001 DICOM 파일 파서 | 7 |
| MOD-002 전송 구문 및 문자 인코딩 처리기 | 5 |
| MOD-003 볼륨 데이터 빌더 | 5 |
| MOD-004 WebGL 렌더링 컨텍스트 관리자 | 5 |
| MOD-005 MPR 렌더러 | 6 |
| MOD-006 3D 볼륨 렌더러 | 5 |
| MOD-007 카메라 시스템 | 5 |
| MOD-008 입력 핸들러 | 5 |
| MOD-009 측정 도구 엔진 | 5 |
| MOD-010 오버레이 렌더러 | 5 |
| MOD-011 환자 데이터 매니저 | 4 |
| MOD-012 뷰포트 동기화 컨트롤러 | 5 |
| MOD-013 보안 및 감사 모듈 | 5 |
| MOD-014 애플리케이션 셸 및 상태 관리 | 7 |
| **총계** | **74** |

---

## 6. 승인 이력

| 버전 | 일자 | 작성자 | 검토자 | 승인자 | 변경 내용 |
|------|------|--------|--------|--------|-----------|
| 1.0 | 2026-05-10 | AutoDevAgent | - | - | 초안 작성 |


