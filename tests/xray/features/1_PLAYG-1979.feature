@REQ_PLAYG-1979
Feature: SR-010 렌더링 성능 요구사항
	#512x512x512 볼륨 크기 기준 MPR 렌더링 ≥30fps, 3D 볼륨 렌더링 ≥15fps 유지. 초기 로딩 시간 ≤5초 이내.

	#매우 큰 용량의 Pixel Data를 포함한 DICOM 파일을 로드할 때, 메모리 부족 오류 없이 정상적으로 파싱을 완료하거나 정의된 제한 내에서 처리하는지 확인한다.
	@TEST_PLAYG-2529 @REQ_PLAYG-2365 @REQ_PLAYG-2352 @TESTSET_PLAYG-2476 @AI
	Scenario: 대용량 DICOM 파일 로드 안정성 확인
		Given 사용자가 DICOM 뷰어 시스템을 실행한 상태이고
		And 시스템이 처리 가능한 최대 메모리 임계값이 설정되어 있으며
		And 매우 큰 용량의 Pixel Data를 포함한 DICOM 파일이 준비되었을 때
		When 사용자가 해당 대용량 DICOM 파일을 시스템에 로드하면
		Then 시스템은 메모리 부족 오류 없이 파일 파싱을 완료하고
		And 정의된 제한 범위 내에서 의료 영상을 정상적으로 화면에 표시한다.
		
	#Patient ID, Rows, Columns, Pixel Data 등 DICOM 표준에서 정의하는 필수 메타데이터 태그 중 하나라도 누락된 파일을 로드할 때, 시스템이 이를 감지하고 로드를 거부하는지 확인한다.
	@TEST_PLAYG-2528 @REQ_PLAYG-2353 @TESTSET_PLAYG-2476 @AI
	Scenario: 필수 DICOM 태그 누락 시 에러 처리
		Given 사용자가 의료 영상 업로드 화면에 접속해 있고
		And 업로드하려는 DICOM 파일에 Patient ID, Rows, Columns 또는 Pixel Data와 같은 필수 메타데이터 태그가 누락되어 있을 때
		When 사용자가 해당 DICOM 파일을 시스템에 로드하면
		Then 시스템은 필수 태그 누락을 감지하여 파일 로드를 거부하고
		And 사용자에게 필수 메타데이터가 누락되었다는 에러 메시지를 표시한다.
		
	#상태 변경이 발생한 시점부터 모든 구독자에게 통지가 완료되는 시점까지의 소요 시간을 측정하여, 요구사항인 16ms 이내에 처리가 완료되는지 확인한다.
	@TEST_PLAYG-2527 @REQ_PLAYG-2365 @REQ_PLAYG-2352 @REQ_PLAYG-2353 @TESTSET_PLAYG-2476 @AI
	Scenario: 상태 변경 통지 지연 시간(Latency) 측정
		Given 시스템에 다수의 구독자가 등록되어 있고
		And 특정 리소스의 상태 변경이 발생하기 직전이며
		When 시스템이 리소스의 상태를 변경하고 모든 구독자에게 통지를 전송하면
		Then 상태 변경 시점부터 마지막 구독자가 통지를 받기까지의 소요 시간이 16ms 이내임이 확인된다.
		
	#연속된 DICOM 슬라이스 파일들을 입력받아 누락이나 순서 뒤바뀜 없이 정확한 3D 볼륨 데이터 구조로 변환되는지 확인한다.
	@TEST_PLAYG-2526 @REQ_PLAYG-2352 @TESTSET_PLAYG-2476 @AI
	Scenario: DICOM 슬라이스의 3D 볼륨 변환 기본 기능 검증
		Given 사용자가 연속된 DICOM 슬라이스 파일 세트를 시스템에 업로드한 상태이고
		And 모든 슬라이스가 누락 없이 올바른 순서로 준비되어 있을 때
		When 시스템이 입력된 DICOM 슬라이스들을 3D 볼륨 데이터 구조로 변환하면
		Then 시스템은 데이터의 누락이나 순서의 뒤바뀜 없이 정확한 3D 볼륨을 생성한다
		
	#WebSocket 또는 WebRTC와 같은 실시간 통신 프로토콜을 이용한 외부 서버와의 연결 시도가 차단되는지 검증한다.
	@TEST_PLAYG-2524 @REQ_PLAYG-2352 @REQ_PLAYG-2354 @TESTSET_PLAYG-2476 @AI
	Scenario: 실시간 통신 프로토콜 차단 검증
		Given 사용자가 시스템 내의 애플리케이션 환경에 접속해 있으며
		And 외부 서버와 실시간 통신을 시도할 준비가 되어 있을 때
		When 사용자가 WebSocket 또는 WebRTC 프로토콜을 사용하여 외부 서버로 연결을 시도하면
		Then 시스템은 해당 연결 요청을 즉시 차단하고
		And 외부 서버와의 실시간 통신 세션 수립이 실패했음을 나타낸다.
		
	#볼륨 데이터 생성 및 해제 반복 시, MemoryPool 내의 ArrayBuffer가 새로 할당되지 않고 기존 버퍼를 효율적으로 재사용하는지 확인한다.
	@TEST_PLAYG-2521 @REQ_PLAYG-2354 @TESTSET_PLAYG-2476 @AI
	Scenario: MemoryPool을 통한 ArrayBuffer 재사용 효율성 검증
		Given 사용자가 볼륨 데이터 처리를 위해 MemoryPool 시스템을 활성화한 상태이고
		And 초기 볼륨 데이터 생성을 위해 특정 크기의 ArrayBuffer가 MemoryPool에 할당되어 있으며
		When 사용자가 기존 볼륨 데이터를 해제하고 동일한 크기의 새로운 볼륨 데이터 생성을 요청하면
		Then 시스템은 새로운 메모리를 할당하지 않고 MemoryPool 내의 기존 ArrayBuffer를 재사용하며
		And MemoryPool의 전체 메모리 할당 횟수가 증가하지 않음을 확인한다.
		
	#HTML 요소(img, script, iframe 등)의 src 속성을 이용한 외부 리소스 요청이 차단되어 로컬 전용 처리 원칙이 준수되는지 검증한다.
	@TEST_PLAYG-2520 @REQ_PLAYG-2365 @REQ_PLAYG-2352 @REQ_PLAYG-2353 @TESTSET_PLAYG-2476 @AI
	Scenario: 리소스 로딩을 통한 아웃바운드 통신 차단 검증
		Given 사용자가 시스템의 콘텐츠 작성 또는 편집 페이지에 접속해 있고
		And 외부 도메인을 가리키는 src 속성을 포함한 HTML 요소인 img, script 또는 iframe을 입력한 상태에서
		When 사용자가 해당 콘텐츠를 저장하거나 미리보기를 실행하여 리소스 로딩을 시도하면
		Then 시스템은 모든 외부 리소스에 대한 아웃바운드 통신 요청을 차단하고
		And 로컬 전용 처리 원칙에 따라 외부 데이터의 유입이 발생하지 않음을 보장한다
		
	#애플리케이션이 지원하는 주요 브라우저(Chrome, Firefox, Safari, Edge 등)에서 초기 로딩 및 기본 기능이 정상 작동하는지 확인한다.
	@TEST_PLAYG-2519 @REQ_PLAYG-2365 @REQ_PLAYG-2352 @REQ_PLAYG-2353 @TESTSET_PLAYG-2476 @AI
	Scenario: 브라우저 호환성 체크 기능 검증
		Given 사용자가 지원 대상 브라우저인 Chrome, Firefox, Safari 또는 Edge를 사용 중이며
		And 애플리케이션의 접속 URL이 준비된 상태에서
		When 사용자가 브라우저를 통해 애플리케이션에 접속하여 초기 로딩을 수행하면
		Then 시스템은 오류 없이 메인 화면을 표시하고
		And 모든 메뉴 클릭 및 버튼 활성화와 같은 기본 기능이 정상적으로 작동한다
		
	#환자 데이터 처리 후 브라우저의 LocalStorage 및 SessionStorage에 민감한 정보가 평문 또는 복구 가능한 형태로 남아있는지 검증한다.
	@TEST_PLAYG-2516 @REQ_PLAYG-2365 @REQ_PLAYG-2352 @TESTSET_PLAYG-2476 @AI
	Scenario: 브라우저 웹 스토리지 내 민감 데이터 잔존 여부 검증
		Given 사용자가 환자 데이터 처리 작업을 완료한 상태이고
		And 브라우저의 개발자 도구가 활성화되어 있으며
		When 사용자가 브라우저의 로컬 스토리지(LocalStorage)와 세션 스토리지(SessionStorage)를 확인하면
		Then 시스템은 어떠한 민감 정보도 평문 또는 복구 가능한 형태로 저장하지 않아야 한다.
		
	#ISO_IR 149(한국어) 인코딩이 적용된 DICOM 파일의 Specific Character Set 태그를 인식하여 한글 데이터를 깨짐 없이 읽어오는지 확인한다.
	@TEST_PLAYG-2515 @REQ_PLAYG-2354 @TESTSET_PLAYG-2476 @AI
	Scenario: ISO_IR 149(EUC-KR) 문자 인코딩 디코딩 검증
		Given 사용자가 ISO_IR 149(EUC-KR) 인코딩이 적용된 DICOM 파일을 시스템에 업로드하고
		And 해당 파일의 Specific Character Set 태그가 "ISO_IR 149"로 설정되어 있으며
		And 환자 이름 및 설명 필드에 한글 데이터가 포함되어 있을 때
		When 시스템이 해당 DICOM 파일의 메타데이터를 읽어오면
		Then 시스템은 한글 데이터를 글자 깨짐 없이 올바르게 디코딩하여 화면에 표시한다.
		
	#DICOM 메타데이터의 Image Position 및 Orientation 정보를 활용하여 슬라이스가 공간상에서 올바른 순서와 간격으로 정렬되는지 검증한다.
	@TEST_PLAYG-2514 @REQ_PLAYG-2354 @TESTSET_PLAYG-2476 @AI
	Scenario: DICOM 메타데이터 기반 슬라이스 정렬 정확도 검증
		Given 사용자가 DICOM 뷰어 시스템에 의료 영상 시리즈를 로드한 상태이고
		And 각 DICOM 파일이 고유한 Image Position(0020,0032)과 Image Orientation(0020,0037) 메타데이터를 포함하고 있을 때
		When 시스템이 메타데이터를 분석하여 슬라이스를 3차원 공간 좌표에 따라 재구성하면
		Then 모든 슬라이스가 공간적 선후 관계에 맞춰 올바른 순서로 나열되고
		And 인접한 슬라이스 간의 간격이 메타데이터에 정의된 수치와 일치하게 정렬된다
		
