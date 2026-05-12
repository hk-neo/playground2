@REQ_PLAYG-1981
Feature: SR-012 환자 데이터 보안 요구사항
	#환자 영상 데이터 및 개인정보의 안전한 처리. 로컬 환경에서만 데이터 처리, 외부 전송 금지. 접근 권한 제어 지원.

	#상태 변경이 발생한 시점부터 모든 구독자에게 통지가 완료되는 시점까지의 소요 시간을 측정하여, 요구사항인 16ms 이내에 처리가 완료되는지 확인한다.
	@TEST_PLAYG-2527 @REQ_PLAYG-2304 @TESTSET_PLAYG-2476 @AI
	Scenario: 상태 변경 통지 지연 시간(Latency) 측정
		Given 시스템에 다수의 구독자가 등록되어 있고
		And 특정 리소스의 상태 변경이 발생하기 직전이며
		When 시스템이 리소스의 상태를 변경하고 모든 구독자에게 통지를 전송하면
		Then 상태 변경 시점부터 마지막 구독자가 통지를 받기까지의 소요 시간이 16ms 이내임이 확인된다.
		
	#WebSocket 또는 WebRTC와 같은 실시간 통신 프로토콜을 이용한 외부 서버와의 연결 시도가 차단되는지 검증한다.
	@TEST_PLAYG-2524 @REQ_PLAYG-2304 @TESTSET_PLAYG-2476 @AI
	Scenario: 실시간 통신 프로토콜 차단 검증
		Given 사용자가 시스템 내의 애플리케이션 환경에 접속해 있으며
		And 외부 서버와 실시간 통신을 시도할 준비가 되어 있을 때
		When 사용자가 WebSocket 또는 WebRTC 프로토콜을 사용하여 외부 서버로 연결을 시도하면
		Then 시스템은 해당 연결 요청을 즉시 차단하고
		And 외부 서버와의 실시간 통신 세션 수립이 실패했음을 나타낸다.
		
	#Explicit VR Big Endian 전송 구문으로 작성된 DICOM 파일을 읽을 때, 바이트 오더링을 정상적으로 변환하여 멀티 바이트 수치 데이터를 정확하게 해석하는지 확인한다.
	@TEST_PLAYG-2523 @REQ_PLAYG-2304 @TESTSET_PLAYG-2476 @AI
	Scenario: Explicit VR Big Endian 바이트 오더링 변환 검증
		Given 사용자가 Explicit VR Big Endian 전송 구문으로 인코딩된 DICOM 파일을 시스템에 로드한 상태이고
		And 해당 파일에 멀티 바이트로 구성된 수치 데이터 요소가 포함되어 있을 때
		When 시스템이 해당 DICOM 파일의 데이터를 읽고 해석하는 프로세스를 실행하면
		Then 시스템은 바이트 오더링을 리틀 엔디안으로 정상적으로 변환하여 처리하고
		And 변환된 수치 데이터 값이 원본 데이터의 의도된 수치와 정확히 일치함을 확인한다
		
	#Specific Character Set 태그가 누락되었거나 지원하지 않는 인코딩 값이 설정된 경우, 시스템이 UTF-8로 폴백(Fallback)하여 데이터를 처리하는지 확인한다.
	@TEST_PLAYG-2522 @REQ_PLAYG-2304 @TESTSET_PLAYG-2476 @AI
	Scenario: 인코딩 감지 실패 시 UTF-8 폴백 동작 검증
		Given 시스템이 DICOM 데이터를 처리하는 단계에 있고
		And 데이터 내에 Specific Character Set 태그가 누락되었거나 지원하지 않는 인코딩 값이 포함되어 있으며
		When 시스템이 데이터의 인코딩 감지를 시도할 때
		Then 시스템은 기본 인코딩 설정을 UTF-8로 폴백하여 적용하고
		And 데이터를 UTF-8 기준으로 정상적으로 처리한다.
		
	#환자 데이터 처리 후 브라우저의 LocalStorage 및 SessionStorage에 민감한 정보가 평문 또는 복구 가능한 형태로 남아있는지 검증한다.
	@TEST_PLAYG-2516 @REQ_PLAYG-2304 @TESTSET_PLAYG-2476 @AI
	Scenario: 브라우저 웹 스토리지 내 민감 데이터 잔존 여부 검증
		Given 사용자가 환자 데이터 처리 작업을 완료한 상태이고
		And 브라우저의 개발자 도구가 활성화되어 있으며
		When 사용자가 브라우저의 로컬 스토리지(LocalStorage)와 세션 스토리지(SessionStorage)를 확인하면
		Then 시스템은 어떠한 민감 정보도 평문 또는 복구 가능한 형태로 저장하지 않아야 한다.
		
